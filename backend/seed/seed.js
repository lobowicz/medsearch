// reads data/pharmacies.csv, drugs.csv, pharmacy_drugs.csv and loads them into PostgreSQL
 
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Client } = require('pg');
require('dotenv').config();

// Helper to parse a CSV into an array of objects
function loadCsv(filename) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(path.join(__dirname, '../../data', filename))
      .pipe(csv({
        separator: '\t',
        headers: true
      }))
      .on('data', (row) => results.push(row))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function seed() {
  const client = new Client();
  await client.connect();

  try {
    // 1) Clear existing data (optional)
    await client.query('TRUNCATE pharmacy_drugs, pharmacies, drugs RESTART IDENTITY;');

    // 2) Load drugs
    const drugRows = await loadCsv('drugs.csv');
    for (const { drug_id, name, synonym } of drugRows) {
      const synonymsArr = synonym
        .replace(/^"|"$/g, '')  // strip quotes if any
        .split('|')
        .map(s => s.trim());
      await client.query(
        `INSERT INTO drugs(id, name, synonyms)
         VALUES ($1, $2, $3)`,
        [drug_id, name.trim(), synonymsArr]
      );
    }
    console.log(`Loaded ${drugRows.length} drugs.`);

    // 3) Load pharmacies
    const pharmRows = await loadCsv('pharmacies.csv');
    for (const { pharm_id, name, address, lat, lng } of pharmRows) {
      await client.query(
        `INSERT INTO pharmacies(id, name, address, geom)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4::float, $5::float), 4326))`,
        [pharm_id, name.trim(), address.trim(), parseFloat(lng), parseFloat(lat)]
      );
    }
    console.log(`Loaded ${pharmRows.length} pharmacies.`);

    // 4) Load pharmacy_drugs
    const pdRows = await loadCsv('pharmacy_drugs.csv');
    for (const { pharm_id, drug_id } of pdRows) {
      await client.query(
        `INSERT INTO pharmacy_drugs(pharmacy_id, drug_id)
         VALUES ($1, $2)`,
        [pharm_id, drug_id]
      );
    }
    console.log(`Loaded ${pdRows.length} pharmacy↔drug links.`);

  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await client.end();
  }
}

seed()
  .then(() => console.log('Seeding complete.'))
  .catch(err => console.error(err));
