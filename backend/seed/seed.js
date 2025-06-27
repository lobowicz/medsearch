// seed.js - Loads CSV data into PostgreSQL database

import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { Client } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Helper to parse a CSV into an array of objects
function loadCsv(filename) {
  return new Promise((resolve, reject) => {
    const results = [];
    const filePath = path.join(__dirname, '../data', filename);
    
    console.log(`Loading CSV: ${filePath}`);
    
    fs.createReadStream(filePath)
      .pipe(csv({
        skipEmptyLines: true,
        mapHeaders: ({ header }) => header.trim() // Clean headers by removing extra spaces
      }))
      .on('data', (row) => {
        // Clean all values by trimming whitespace
        const cleanRow = {};
        Object.keys(row).forEach(key => {
          cleanRow[key] = typeof row[key] === 'string' ? row[key].trim() : row[key];
        });
        results.push(cleanRow);
      })
      .on('end', () => {
        console.log(`Loaded ${results.length} rows from ${filename}`);
        resolve(results);
      })
      .on('error', (err) => {
        console.error(`Error loading ${filename}:`, err);
        reject(err);
      });
  });
}

// Batch insert helper for better performance
async function batchInsert(client, query, data, batchSize = 1000) {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const values = [];
    const placeholders = [];
    
    batch.forEach((row, index) => {
      const baseIndex = index * row.length;
      const rowPlaceholders = row.map((_, colIndex) => `$${baseIndex + colIndex + 1}`);
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
      values.push(...row);
    });
    
    const fullQuery = `${query} VALUES ${placeholders.join(', ')}`;
    await client.query(fullQuery, values);
  }
}

async function seed() {
  // Create client - automatically uses environment variables
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Database connected');

    // Start transaction for data integrity
    await client.query('BEGIN');

    // 1) Clear existing data 
    console.log('Clearing existing data...');
    await client.query('TRUNCATE pharmacy_drugs, pharmacies, drugs RESTART IDENTITY CASCADE;');
    console.log('Tables cleared');

    // 2) Load drugs
    console.log('Loading drugs...');
    const drugRows = await loadCsv('drugs.csv');
    const validDrugs = [];
    let skippedDrugs = 0;

    for (const row of drugRows) {
      const { drug_id, name, synonym } = row;
      
      // Check if we have required fields (allow empty synonym)
      if (!drug_id || !name) {
        console.warn('Skipping invalid drug row - missing drug_id or name:', row);
        skippedDrugs++;
        continue;
      }
      
      // Parse synonyms - handle quoted strings and split by |
      let synonymsArr = [];
      if (synonym && synonym.length > 0) {
        synonymsArr = synonym
          .replace(/^"|"$/g, '')  // Remove surrounding quotes
          .split('|')
          .map(s => s.trim())
          .filter(s => s.length > 0); // Remove empty strings
      }

      const drugId = parseInt(drug_id);
      if (isNaN(drugId)) {
        console.warn('Skipping drug with invalid ID:', row);
        skippedDrugs++;
        continue;
      }

      await client.query(
        `INSERT INTO drugs(id, name, synonyms) VALUES ($1, $2, $3)`,
        [drugId, name, synonymsArr]
      );
      validDrugs.push(row);
    }
    console.log(`Loaded ${validDrugs.length} drugs to database (skipped ${skippedDrugs})`);

    // 3) Check pharmacy table structure first
    console.log('Checking pharmacy table structure...');
    const pharmColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'pharmacies'
      ORDER BY ordinal_position
    `);
    const availableColumns = pharmColumns.rows.map(row => row.column_name);
    console.log('Available pharmacy columns:', availableColumns);
    
    const hasRegionColumn = availableColumns.includes('region');
    console.log('Has region column:', hasRegionColumn);

    // 3) Load pharmacies
    console.log('Loading pharmacies...');
    const pharmRows = await loadCsv('pharmacies.csv');
    const validPharmacies = [];
    let skippedPharmacies = 0;

    for (const row of pharmRows) {
      const { pharm_id, name, address, lat, lon, region } = row;
      
      // Require pharm_id and name, but lat/lon are optional
      if (!pharm_id || !name) {
        console.warn('Skipping invalid pharmacy row - missing pharm_id or name:', row);
        skippedPharmacies++;
        continue;
      }

      const pharmId = parseInt(pharm_id);
      if (isNaN(pharmId)) {
        console.warn('Skipping pharmacy with invalid ID:', row);
        skippedPharmacies++;
        continue;
      }

      // Clean address & region - remove quotes
      const cleanAddress = address ? address.replace(/^"|"$/g, '').trim() : '';
      const cleanRegion = (region || '').trim();
      
      // Skip pharmacies without valid coordinates
      if (!lat || !lon || lat.trim() === '' || lon.trim() === '') {
        console.log(`Skipping pharmacy ${pharmId} (${name}) - missing coordinates`);
        skippedPharmacies++;
        continue;
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);
      
      if (isNaN(latitude) || isNaN(longitude)) {
        console.log(`Skipping pharmacy ${pharmId} (${name}) - invalid coordinates: ${lat}, ${lon}`);
        skippedPharmacies++;
        continue;
      }
      
      // Insert with valid coordinates only
      if (hasRegionColumn) {
        await client.query(
          `INSERT INTO pharmacies(id, name, address, region, geom) 
           VALUES ($1, $2, $3, $4, ST_GeogFromText('POINT(' || $5 || ' ' || $6 || ')'))`,
          [pharmId, name, cleanAddress, cleanRegion, longitude, latitude]
        );
      } else {
        await client.query(
          `INSERT INTO pharmacies(id, name, address, geom) 
           VALUES ($1, $2, $3, ST_GeogFromText('POINT(' || $4 || ' ' || $5 || ')'))`,
          [pharmId, name, cleanAddress, longitude, latitude]
        );
      }
      
      validPharmacies.push(row);
    }
    console.log(`Loaded ${validPharmacies.length} pharmacies to database (skipped ${skippedPharmacies})`);

    // 4) Create lookup sets for valid IDs to avoid foreign key violations
    console.log('Creating ID lookup sets...');
    const validDrugIds = new Set();
    const drugIdResult = await client.query('SELECT id FROM drugs');
    drugIdResult.rows.forEach(row => validDrugIds.add(row.id));
    
    const validPharmacyIds = new Set();
    const pharmIdResult = await client.query('SELECT id FROM pharmacies');
    pharmIdResult.rows.forEach(row => validPharmacyIds.add(row.id));
    
    console.log(`Valid drug IDs: ${validDrugIds.size}, Valid pharmacy IDs: ${validPharmacyIds.size}`);

    // 5) Load pharmacy_drugs relationships with pre-validation
    console.log('Loading pharmacy-drug relationships...');
    const pdRows = await loadCsv('pharmacy_drugs.csv');
    const validRelationships = [];
    let skippedRelationships = 0;

    // Prepare batch insert for better performance
    const relationshipData = [];

    for (const row of pdRows) {
      const { pharm_id, drug_id } = row;
      
      if (!pharm_id || !drug_id) {
        console.warn('Skipping invalid relationship row - missing IDs:', row);
        skippedRelationships++;
        continue;
      }

      const pharmId = parseInt(pharm_id);
      const drugId = parseInt(drug_id);
      
      if (isNaN(pharmId) || isNaN(drugId)) {
        console.warn('Skipping relationship with invalid IDs:', row);
        skippedRelationships++;
        continue;
      }

      // Pre-validate that both IDs exist
      if (!validPharmacyIds.has(pharmId)) {
        console.warn(`Skipping relationship - pharmacy ${pharmId} doesn't exist`);
        skippedRelationships++;
        continue;
      }

      if (!validDrugIds.has(drugId)) {
        console.warn(`Skipping relationship - drug ${drugId} doesn't exist`);
        skippedRelationships++;
        continue;
      }

      relationshipData.push([pharmId, drugId]);
      validRelationships.push(row);
    }

    // Batch insert all valid relationships
    if (relationshipData.length > 0) {
      console.log(`Inserting ${relationshipData.length} valid relationships...`);
      await batchInsert(
        client, 
        'INSERT INTO pharmacy_drugs(pharmacy_id, drug_id)', 
        relationshipData,
        1000
      );
    }

    console.log(`Loaded ${validRelationships.length} pharmacy-drug relationships to database (skipped ${skippedRelationships})`);

    // Commit transaction
    await client.query('COMMIT');

    // 6) Verify data was loaded correctly
    console.log('\n=== Data Verification ===');
    const drugCount = await client.query('SELECT COUNT(*) FROM drugs');
    console.log(`Drugs: ${drugCount.rows[0].count}`);
    
    const pharmCount = await client.query('SELECT COUNT(*) FROM pharmacies');
    console.log(`Pharmacies: ${pharmCount.rows[0].count} (all with valid coordinates)`);
    
    const relationCount = await client.query('SELECT COUNT(*) FROM pharmacy_drugs');
    console.log(`Relationships: ${relationCount.rows[0].count}`);
    
    // Test sample queries
    console.log('\n=== Sample Queries ===');
    
    // Get drugs with most pharmacy relationships
    const topDrugs = await client.query(`
      SELECT 
        d.name as drug_name,
        COUNT(pd.pharmacy_id) as pharmacy_count
      FROM drugs d
      LEFT JOIN pharmacy_drugs pd ON d.id = pd.drug_id
      GROUP BY d.id, d.name
      ORDER BY pharmacy_count DESC
      LIMIT 5
    `);
    
    console.log('\nTop 5 drugs by pharmacy availability:');
    topDrugs.rows.forEach(row => {
      console.log(`${row.drug_name}: available at ${row.pharmacy_count} pharmacies`);
    });

    // Get pharmacies by region (if region column exists)
    if (hasRegionColumn) {
      const regionStats = await client.query(`
        SELECT 
          region,
          COUNT(*) as pharmacy_count
        FROM pharmacies 
        WHERE region IS NOT NULL AND region != ''
        GROUP BY region
        ORDER BY pharmacy_count DESC
        LIMIT 5
      `);
      
      console.log('\nTop 5 regions by pharmacy count:');
      regionStats.rows.forEach(row => {
        console.log(`${row.region}: ${row.pharmacy_count} pharmacies`);
      });
    } else {
      console.log('\nRegion column not available - skipping region statistics');
    }

    // Sample drug search
    const sampleDrug = await client.query(`
      SELECT 
        p.name as pharmacy_name,
        p.address,
        ${hasRegionColumn ? 'p.region,' : ''}
        ROUND(ST_Y(p.geom::geometry)::numeric, 4) as latitude,
        ROUND(ST_X(p.geom::geometry)::numeric, 4) as longitude
      FROM pharmacies p
      JOIN pharmacy_drugs pd ON p.id = pd.pharmacy_id
      JOIN drugs d ON pd.drug_id = d.id
      WHERE d.name ILIKE '%abacavir%'
      LIMIT 5
    `);
    
    if (sampleDrug.rows.length > 0) {
      console.log('\nSample - Pharmacies with abacavir:');
      sampleDrug.rows.forEach(row => {
        const regionInfo = hasRegionColumn && row.region ? ` (${row.region})` : '';
        console.log(`${row.pharmacy_name}${regionInfo} - ${row.latitude}, ${row.longitude}`);
      });
    } else {
      console.log('\nNo pharmacies found with abacavir in stock');
    }

  } catch (err) {
    console.error('Seeding error:', err);
    // Rollback on error
    try {
      await client.query('ROLLBACK');
      console.log('Transaction rolled back');
    } catch (rollbackErr) {
      console.error('Rollback error:', rollbackErr);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

// Run seeder
seed()
  .then(() => {
    console.log('\nSeeding completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
  