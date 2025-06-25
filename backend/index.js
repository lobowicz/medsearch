import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 1) Set up PostgreSQL connection pool
const pool = new Pool();

// 2) API route: GET /api/search
app.get('/api/search', async (req, res) => {
  try {
    // a) Validate & parse query params
    const { medicine, lat, lng, radius } = req.query;
    if (!medicine || !lat || !lng || !radius) {
      return res.status(400).json({ error: 'medicine, lat, lng & radius are required' });
    }
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const radKm    = parseInt(radius, 10);

    console.log(`Searching for "${medicine}" within ${radKm}km of (${userLat}, ${userLng})`);

    // b) Run the SQL: find matching drug IDs via full-text,
    //    then join to pharmacy_drugs & pharmacies within radius
    const q = `
      WITH matched_drugs AS (
        SELECT id, name
        FROM drugs
        WHERE to_tsvector('english', drugs_search_text(name, synonyms))
              @@ plainto_tsquery($1)
      )
      SELECT
        p.id            AS pharmacy_id,
        p.name,
        p.address,
        ST_Y(p.geom::geometry) AS lat,
        ST_X(p.geom::geometry) AS lng,
        ROUND((ST_Distance(
              p.geom,
              ST_MakePoint($3, $2)::geography
            ) / 1000.0)::numeric, 
             2) AS distance_km,
        array_agg(DISTINCT md.name) AS matched_drugs
      FROM pharmacies p
      JOIN pharmacy_drugs pd ON pd.pharmacy_id = p.id
      JOIN matched_drugs md ON md.id = pd.drug_id
      WHERE ST_DWithin(
              p.geom,
              ST_MakePoint($3, $2),
              $4 * 1000   -- radius in meters
            )
      GROUP BY p.id, p.name, p.address, p.geom
      ORDER BY distance_km
      LIMIT 50;
    `;

    const { rows } = await pool.query(q, [
      medicine,       // $1 - search term
      userLat,        // $2 - lat
      userLng,        // $3 - lng
      radKm           // $4 - radius km
    ]);

    console.log(`Found ${rows.length} pharmacies`);

    // c) Return standardized JSON
    res.json({
      query: { medicine, lat: userLat, lng: userLng, radius: radKm },
      results: rows
    });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// 2.5) autocomplete api/suggest
app.get('api/suggest', async (req, res) => {
  try {
    const { prefix } = req.query;
    if (!prefix || prefix.trim().length < 2) {  // suggest when length >= 2
      return res.json({ suggestions: [] });
    }

    // search through drugs.name
    const q = `SELECT name FROM drugs WHERE name ILIKE $1 ORDER BY name LIMIT 10`;
    const { rows } = await pool.query(q, [`${prefix.trim()}%`]);
    const suggestions = rows.map(r => r.name);
    res.json({ suggestions });
  } catch (err) {
    console.error('Suggest error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3) Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
  console.log(`Search: http://localhost:${PORT}/api/search`);
});
