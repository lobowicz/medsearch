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
    const filePath = path.join(__dirname, '../../data', filename);
    
    console.log(`Loading CSV: ${filePath}`);
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {        
        // Debug: log the raw row to see what we're getting
        // console.log('Raw row:', JSON.stringify(row));
        results.push(row);
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

async function seed() {
  // Create client - automatically uses environment variables
  const client = new Client();

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Database connected');

    // 1) Clear existing data (optional - comment out if you want to keep existing data)
    console.log('Clearing existing data...');
    await client.query('TRUNCATE pharmacy_drugs, pharmacies, drugs RESTART IDENTITY CASCADE;');
    console.log('Tables cleared');

    // 2) Load drugs
    console.log('Loading drugs...');
    const drugRows = await loadCsv('drugs.csv');
    
    for (const row of drugRows) {
      const { drug_id, name, synonym } = row;
      
      if (!drug_id || !name) {
        console.warn('Skipping invalid drug row:', row);
        continue;
      }
      
      // Parse synonyms - handle quoted strings and split by |
      let synonymsArr = [];
      if (synonym) {
        synonymsArr = synonym
          .replace(/^"|"$/g, '')  // Remove surrounding quotes
          .split('|')
          .map(s => s.trim())
          .filter(s => s.length > 0); // Remove empty strings
      }
      
      await client.query(
        `INSERT INTO drugs(id, name, synonyms) VALUES ($1, $2, $3)`,
        [parseInt(drug_id), name.trim(), synonymsArr]
      );
    }
    console.log(`Loaded ${drugRows.length} drugs to database`);

    // 3) Load pharmacies
    console.log('Loading pharmacies...');
    const pharmRows = await loadCsv('pharmacies.csv');
    
    for (const row of pharmRows) {
      const { pharm_id, name, address, lat, lon } = row; // Note: your CSV has 'lon' not 'lng'
      
      if (!pharm_id || !name || !lat || !lon) {
        console.warn('Skipping invalid pharmacy row:', row);
        continue;
      }
      
      // Clean address - remove quotes
      const cleanAddress = address ? address.replace(/^"|"$/g, '').trim() : '';
      
      // Insert with PostGIS point (longitude first, then latitude)
      await client.query(
        `INSERT INTO pharmacies(id, name, address, geom) 
         VALUES ($1, $2, $3, ST_GeogFromText('POINT(' || $4 || ' ' || $5 || ')'))`,
        [
          parseInt(pharm_id), 
          name.trim(), 
          cleanAddress,
          parseFloat(lon), // longitude first
          parseFloat(lat)  // latitude second
        ]
      );
    }
    console.log(`Loaded ${pharmRows.length} pharmacies to database`);

    // 4) Load pharmacy_drugs relationships
    console.log('Loading pharmacy-drug relationships...');
    const pdRows = await loadCsv('pharmacy_drugs.csv');
    
    for (const row of pdRows) {
      const { pharm_id, drug_id } = row;
      
      if (!pharm_id || !drug_id) {
        console.warn('Skipping invalid relationship row:', row);
        continue;
      }
      
      await client.query(
        `INSERT INTO pharmacy_drugs(pharmacy_id, drug_id) VALUES ($1, $2)`,
        [parseInt(pharm_id), parseInt(drug_id)]
      );
    }
    console.log(`Loaded ${pdRows.length} pharmacy-drug relationships to database`);

    // 5) Verify data was loaded correctly
    console.log('\nData verification:');
    
    const drugCount = await client.query('SELECT COUNT(*) FROM drugs');
    console.log(`Drugs: ${drugCount.rows[0].count}`);
    
    const pharmCount = await client.query('SELECT COUNT(*) FROM pharmacies');
    console.log(`Pharmacies: ${pharmCount.rows[0].count}`);
    
    const relationCount = await client.query('SELECT COUNT(*) FROM pharmacy_drugs');
    console.log(`Relationships: ${relationCount.rows[0].count}`);
    
    // Test sample query
    // const sampleQuery = await client.query(`
    //   SELECT DISTINCT 
    //     p.name as pharmacy_name, 
    //     d.name as drug_name
    //   FROM pharmacies p
    //   JOIN pharmacy_drugs pd ON p.id = pd.pharmacy_id
    //   JOIN drugs d ON pd.drug_id = d.id
    //   WHERE d.name = 'amoxicillin'
    //   LIMIT 3
    // `);
    
    // console.log('\n Sample query - Pharmacies selling amoxicillin:');
    // sampleQuery.rows.forEach(row => {
    //   console.log(`${row.pharmacy_name} sells ${row.drug_name}`);
    // });

  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

// run seeder
seed()
  .then(() => {
    console.log('\n Seeding completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
