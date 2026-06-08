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
  .catch(err => console.error("Error checking table:", err));

// GET: Fetch all expenses
app.get('/api/expenses', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM expenses ORDER BY date DESC');
        res.json(result.rows);
    } catch (err) {
        console.error("Fetch Error:", err);
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});

// POST: Add a new expense
app.post('/api/expenses', async (req, res) => {
    const { description, amount, category } = req.body;
    
    // Basic Input Validation
    if (!description || !amount || !category) {
        return res.status(400).json({ error: 'Description, amount, and category are required' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO expenses (description, amount, category) VALUES ($1, $2, $3) RETURNING *',
            [description, amount, category]
        );
        res.status(201).json(result.rows[0]); // 201 Created
    } catch (err) {
        console.error("Insert Error:", err);
        res.status(500).json({ error: 'Failed to add expense' });
    }
});

// DELETE: Remove an expense by ID (NEW FEATURE)
app.delete('/api/expenses/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        
        res.json({ message: 'Expense deleted successfully', deletedExpense: result.rows[0] });
    } catch (err) {
        console.error("Delete Error:", err);
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));