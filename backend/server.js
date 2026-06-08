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

// Initialize Database Tables
const initDB = async () => {
    try {
        // Expenses Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS expenses (
                id SERIAL PRIMARY KEY,
                description VARCHAR(255) NOT NULL,
                amount NUMERIC NOT NULL,
                category VARCHAR(50) NOT NULL,
                date DATE DEFAULT CURRENT_DATE
            );
        `);
        // Settings Table (for storing the budget)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                monthly_budget NUMERIC DEFAULT 0
            );
        `);
        // Ensure at least one settings row exists
        await pool.query(`
            INSERT INTO settings (monthly_budget) 
            SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM settings);
        `);
        console.log("Database tables are ready!");
    } catch (err) {
        console.error("Error checking tables:", err);
    }
};

initDB();

// ---------------- EXPENSES API ----------------

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
    
    if (!description || !amount || !category) {
        return res.status(400).json({ error: 'Description, amount, and category are required' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO expenses (description, amount, category) VALUES ($1, $2, $3) RETURNING *',
            [description, amount, category]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Insert Error:", err);
        res.status(500).json({ error: 'Failed to add expense' });
    }
});

// PUT: Update an existing expense
app.put('/api/expenses/:id', async (req, res) => {
    const { id } = req.params;
    const { description, amount, category } = req.body;

    if (!description || !amount || !category) {
        return res.status(400).json({ error: 'Description, amount, and category are required' });
    }

    try {
        const result = await pool.query(
            'UPDATE expenses SET description = $1, amount = $2, category = $3 WHERE id = $4 RETURNING *',
            [description, amount, category, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Update Error:", err);
        res.status(500).json({ error: 'Failed to update expense' });
    }
});

// DELETE: Remove an expense by ID
app.delete('/api/expenses/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
        res.json({ message: 'Expense deleted successfully' });
    } catch (err) {
        console.error("Delete Error:", err);
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});

// ---------------- SETTINGS API (BUDGET) ----------------

// GET: Fetch budget setting
app.get('/api/settings/budget', async (req, res) => {
    try {
        const result = await pool.query('SELECT monthly_budget FROM settings LIMIT 1');
        res.json({ budget: result.rows[0] ? Number(result.rows[0].monthly_budget) : 0 });
    } catch (err) {
        console.error("Fetch Budget Error:", err);
        res.status(500).json({ error: 'Failed to fetch budget' });
    }
});

// PUT: Update budget setting
app.put('/api/settings/budget', async (req, res) => {
    const { budget } = req.body;
    if (budget === undefined || budget < 0) {
        return res.status(400).json({ error: 'Valid budget amount is required' });
    }
    try {
        await pool.query('UPDATE settings SET monthly_budget = $1', [budget]);
        res.json({ message: 'Budget updated successfully', budget });
    } catch (err) {
        console.error("Update Budget Error:", err);
        res.status(500).json({ error: 'Failed to update budget' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));