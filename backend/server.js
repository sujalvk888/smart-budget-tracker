const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Use a secure key in production (via .env)
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_123';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Initialize Database Tables
const initDB = async () => {
    try {
        // Users Table for Authentication
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Expenses Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS expenses (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                description VARCHAR(255) NOT NULL,
                amount NUMERIC NOT NULL,
                category VARCHAR(50) NOT NULL,
                date DATE DEFAULT CURRENT_DATE
            );
        `);

        // Settings Table (Budgets)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL UNIQUE,
                monthly_budget NUMERIC DEFAULT 0
            );
        `);

        console.log("Database tables ready for secure authentication!");
    } catch (err) {
        console.error("Error checking tables:", err);
    }
};

initDB();

// ---------------- AUTHENTICATION API ----------------

// POST: Register a new user
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
            [username, hashedPassword]
        );
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST: Login user and return JWT
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Generate Token (Expires in 24 hours)
        const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, username: user.username });
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// ---------------- JWT MIDDLEWARE ----------------
// This protects all routes below it
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.userId = decoded.username; // We use username as the user_id identifier to match existing DB records
        next();
    });
};

app.use('/api/expenses', authenticateToken);
app.use('/api/settings', authenticateToken);

// ---------------- EXPENSES API ----------------

app.get('/api/expenses', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM expenses WHERE user_id = $1 ORDER BY date DESC', [req.userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});

app.post('/api/expenses', async (req, res) => {
    const { description, amount, category, date } = req.body;
    try {
        const expenseDate = date || new Date().toISOString().split('T')[0];
        const result = await pool.query(
            'INSERT INTO expenses (user_id, description, amount, category, date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [req.userId, description, amount, category, expenseDate]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add expense' });
    }
});

app.put('/api/expenses/:id', async (req, res) => {
    const { id } = req.params;
    const { description, amount, category, date } = req.body;
    try {
        const expenseDate = date || new Date().toISOString().split('T')[0];
        const result = await pool.query(
            'UPDATE expenses SET description = $1, amount = $2, category = $3, date = $4 WHERE id = $5 AND user_id = $6 RETURNING *',
            [description, amount, category, expenseDate, id, req.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update expense' });
    }
});

app.delete('/api/expenses/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING *', [id, req.userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
        res.json({ message: 'Expense deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});

// ---------------- SETTINGS API (BUDGET) ----------------

app.get('/api/settings/budget', async (req, res) => {
    try {
        const result = await pool.query('SELECT monthly_budget FROM settings WHERE user_id = $1 LIMIT 1', [req.userId]);
        if (result.rows.length === 0) {
            await pool.query('INSERT INTO settings (user_id, monthly_budget) VALUES ($1, 0) ON CONFLICT DO NOTHING', [req.userId]);
            return res.json({ budget: 0 });
        }
        res.json({ budget: Number(result.rows[0].monthly_budget) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch budget' });
    }
});

app.put('/api/settings/budget', async (req, res) => {
    const { budget } = req.body;
    try {
        await pool.query(
            'INSERT INTO settings (user_id, monthly_budget) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET monthly_budget = $2',
            [req.userId, budget]
        );
        res.json({ message: 'Budget updated successfully', budget });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update budget' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));