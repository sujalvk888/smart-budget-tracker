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

// Initialize Database Tables & Handle Migrations
const initDB = async () => {
    try {
        // Expenses Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS expenses (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL DEFAULT 'default',
                description VARCHAR(255) NOT NULL,
                amount NUMERIC NOT NULL,
                category VARCHAR(50) NOT NULL,
                date DATE DEFAULT CURRENT_DATE
            );
        `);
        // Safely add user_id to existing expenses table if it's missing
        try { await pool.query(`ALTER TABLE expenses ADD COLUMN user_id VARCHAR(50) NOT NULL DEFAULT 'default';`); } catch (e) {}

        // Settings Table (for storing the budget)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL DEFAULT 'default',
                monthly_budget NUMERIC DEFAULT 0,
                UNIQUE(user_id)
            );
        `);
        // Safely add user_id to existing settings table if it's missing
        try { 
            await pool.query(`ALTER TABLE settings ADD COLUMN user_id VARCHAR(50) NOT NULL DEFAULT 'default';`); 
            await pool.query(`ALTER TABLE settings ADD CONSTRAINT unique_user_id UNIQUE(user_id);`);
        } catch (e) {}

        console.log("Database tables are ready and support multiple users!");
    } catch (err) {
        console.error("Error checking tables:", err);
    }
};

initDB();

// Middleware to extract user_id from headers
const getUser = (req, res, next) => {
    req.userId = req.headers['x-user-id'] || 'default';
    next();
};

app.use(getUser);

// ---------------- EXPENSES API ----------------

// GET: Fetch all expenses for logged-in user
app.get('/api/expenses', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM expenses WHERE user_id = $1 ORDER BY date DESC', [req.userId]);
        res.json(result.rows);
    } catch (err) {
        console.error("Fetch Error:", err);
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});

// POST: Add a new expense
app.post('/api/expenses', async (req, res) => {
    const { description, amount, category, date } = req.body;
    
    if (!description || !amount || !category) {
        return res.status(400).json({ error: 'Description, amount, and category are required' });
    }

    try {
        const expenseDate = date || new Date().toISOString().split('T')[0];
        const result = await pool.query(
            'INSERT INTO expenses (user_id, description, amount, category, date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [req.userId, description, amount, category, expenseDate]
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
    const { description, amount, category, date } = req.body;

    if (!description || !amount || !category) {
        return res.status(400).json({ error: 'Description, amount, and category are required' });
    }

    try {
        const expenseDate = date || new Date().toISOString().split('T')[0];
        const result = await pool.query(
            'UPDATE expenses SET description = $1, amount = $2, category = $3, date = $4 WHERE id = $5 AND user_id = $6 RETURNING *',
            [description, amount, category, expenseDate, id, req.userId]
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
        const result = await pool.query('DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING *', [id, req.userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
        res.json({ message: 'Expense deleted successfully' });
    } catch (err) {
        console.error("Delete Error:", err);
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});

// ---------------- SETTINGS API (BUDGET) ----------------

// GET: Fetch budget setting for user
app.get('/api/settings/budget', async (req, res) => {
    try {
        const result = await pool.query('SELECT monthly_budget FROM settings WHERE user_id = $1 LIMIT 1', [req.userId]);
        
        // If user doesn't have a budget yet, create a default one
        if (result.rows.length === 0) {
            await pool.query('INSERT INTO settings (user_id, monthly_budget) VALUES ($1, 0) ON CONFLICT DO NOTHING', [req.userId]);
            return res.json({ budget: 0 });
        }
        res.json({ budget: Number(result.rows[0].monthly_budget) });
    } catch (err) {
        console.error("Fetch Budget Error:", err);
        res.status(500).json({ error: 'Failed to fetch budget' });
    }
});

// PUT: Update budget setting for user
app.put('/api/settings/budget', async (req, res) => {
    const { budget } = req.body;
    if (budget === undefined || budget < 0) {
        return res.status(400).json({ error: 'Valid budget amount is required' });
    }
    try {
        await pool.query(
            'INSERT INTO settings (user_id, monthly_budget) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET monthly_budget = $2',
            [req.userId, budget]
        );
        res.json({ message: 'Budget updated successfully', budget });
    } catch (err) {
        console.error("Update Budget Error:", err);
        res.status(500).json({ error: 'Failed to update budget' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));