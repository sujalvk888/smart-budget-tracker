const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to PostgreSQL dynamically
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Automatically create the table if it doesn't exist
pool.query(`
  CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      description VARCHAR(255) NOT NULL,
      amount NUMERIC NOT NULL,
      category VARCHAR(50) NOT NULL,
      date DATE DEFAULT CURRENT_DATE
  );
`).then(() => console.log("Database table is ready!"))
  .catch(err => console.log("Error checking table:", err));

// GET: Fetch all expenses
app.get('/api/expenses', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM expenses ORDER BY date DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST: Add a new expense
app.post('/api/expenses', async (req, res) => {
    const { description, amount, category } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO expenses (description, amount, category) VALUES ($1, $2, $3) RETURNING *',
            [description, amount, category]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));