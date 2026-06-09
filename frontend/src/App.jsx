import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css';

function App() {
  // --- AUTHENTICATION STATE ---
  const [token, setToken] = useState(localStorage.getItem('tracker_token') || null);
  const [user, setUser] = useState(localStorage.getItem('tracker_username') || '');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // --- APP STATE ---
  const [expenses, setExpenses] = useState([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingId, setEditingId] = useState(null);
  const [budget, setBudget] = useState(0);
  const [budgetInput, setBudgetInput] = useState('');
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Refined Color Palette matched to the provided image aesthetic
  const COLORS = ['#65a30d', '#15803d', '#eab308', '#84cc16', '#111827', '#bef264', '#4ade80', '#4b5563'];
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // --- API CONFIG ---
  const getHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  axios.interceptors.response.use(response => response, error => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      handleLogout();
    }
    return Promise.reject(error);
  });

  // --- AUTHENTICATION HANDLERS ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!authUsername.trim() || !authPassword.trim()) return setAuthError('Fields cannot be empty.');

    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}${endpoint}`, {
        username: authUsername.trim(),
        password: authPassword.trim()
      });

      if (isLoginMode) {
        const { token, username } = response.data;
        setToken(token);
        setUser(username);
        localStorage.setItem('tracker_token', token);
        localStorage.setItem('tracker_username', username);
      } else {
        setIsLoginMode(true);
        setAuthPassword('');
        setAuthError('Registration successful! Please log in.');
      }
    } catch (error) {
      setAuthError(error.response?.data?.error || 'An error occurred. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser('');
    setExpenses([]);
    localStorage.removeItem('tracker_token');
    localStorage.removeItem('tracker_username');
  };

  // --- DATA FETCHING & CRUD ---
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [expensesRes, budgetRes] = await Promise.all([
        axios.get(`${API_URL}/api/expenses`, getHeaders()),
        axios.get(`${API_URL}/api/settings/budget`, getHeaders())
      ]);
      setExpenses(expensesRes.data);
      setBudget(budgetRes.data.budget);
      setBudgetInput(budgetRes.data.budget);
    } catch (error) {
      console.error('Error fetching data:', error);
      setErrorMsg('Failed to load data. Ensure server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description || !amount || !date) return alert('Please fill in all fields');
    setErrorMsg('');

    try {
      const payload = { description, amount: parseFloat(amount), category, date };
      if (editingId) {
        await axios.put(`${API_URL}/api/expenses/${editingId}`, payload, getHeaders());
        setEditingId(null);
      } else {
        await axios.post(`${API_URL}/api/expenses`, payload, getHeaders());
      }
      setDescription(''); setAmount(''); setCategory('Food'); setDate(new Date().toISOString().split('T')[0]);
      fetchData(); 
    } catch (error) {
      setErrorMsg('Failed to save expense.');
    }
  };

  const deleteExpense = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await axios.delete(`${API_URL}/api/expenses/${id}`, getHeaders());
      fetchData();
    } catch (error) {
      setErrorMsg('Failed to delete expense.');
    }
  };

  const startEdit = (exp) => {
    setEditingId(exp.id);
    setDescription(exp.description);
    setAmount(exp.amount);
    setCategory(exp.category);
    setDate(new Date(exp.date).toISOString().split('T')[0]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateBudget = async () => {
    if (budgetInput === '' || Number(budgetInput) < 0) return alert('Enter a valid budget');
    try {
      await axios.put(`${API_URL}/api/settings/budget`, { budget: Number(budgetInput) }, getHeaders());
      setBudget(Number(budgetInput));
      setIsEditingBudget(false);
    } catch (error) {
      setErrorMsg('Failed to update budget.');
    }
  };

  // --- CALCULATIONS & UTILS ---
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => new Date(exp.date).toISOString().slice(0, 7) === selectedMonth);
  }, [expenses, selectedMonth]);

  const totalSpent = filteredExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const remainingBudget = budget - totalSpent;
  const progressPercentage = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;

  const getChartData = () => {
    const dataMap = {};
    filteredExpenses.forEach(exp => { dataMap[exp.category] = (dataMap[exp.category] || 0) + Number(exp.amount); });
    return Object.keys(dataMap).map(key => ({ name: key, value: dataMap[key] }));
  };

  // Helper to format currency beautifully
  const formatRupees = (val) => {
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // --------------------------------------------------------
  // RENDER AUTHENTICATION PAGE
  // --------------------------------------------------------
  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-icon">💸</div>
          <h2 className="auth-title">Smart Budget</h2>
          <p className="auth-subtitle">
            {isLoginMode ? 'Welcome back! Please login to your account.' : 'Create a new account to get started.'}
          </p>

          {authError && (
            <div className={`alert ${authError.includes('successful') ? 'alert-success' : 'alert-error'}`}>
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Username</label>
              <input 
                type="text" 
                className="modern-input"
                placeholder="Enter your username" 
                value={authUsername} 
                onChange={(e) => setAuthUsername(e.target.value)} 
                required 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="modern-input"
                placeholder="Enter your password" 
                value={authPassword} 
                onChange={(e) => setAuthPassword(e.target.value)} 
                required 
              />
            </div>

            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Processing...' : (isLoginMode ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <p className="auth-switch">
            {isLoginMode ? "Don't have an account? " : "Already have an account? "}
            <span onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); setAuthPassword(''); }}>
              {isLoginMode ? 'Sign Up' : 'Log In'}
            </span>
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // RENDER DASHBOARD
  // --------------------------------------------------------
  return (
    <div className="dashboard-layout">
      {/* HEADER */}
      <header className="top-nav">
        <div className="nav-brand">
          <span style={{ fontSize: '26px' }}>💸</span> SmartTracker
        </div>
        <div className="user-profile">
          <span style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Hi, {user} 👋</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <main className="main-content">
        {errorMsg && <div className="alert alert-error">{errorMsg}</div>}

        <div className="controls-bar">
          <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>Overview</h2>
          <div className="month-selector">
            <label>Timeline:</label>
            <input 
              type="month" 
              className="modern-input"
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)} 
              style={{ width: 'auto', padding: '10px 14px', margin: 0 }}
            />
          </div>
        </div>

        {/* DASHBOARD WIDGETS */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">Monthly Budget</div>
            {isEditingBudget ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="number" 
                  className="modern-input" 
                  value={budgetInput} 
                  onChange={e => setBudgetInput(e.target.value)} 
                  style={{ margin: 0, padding: '8px' }}
                />
                <button onClick={updateBudget} className="icon-btn" style={{ background: 'var(--primary)', color: 'white' }}>Save</button>
                <button onClick={() => setIsEditingBudget(false)} className="icon-btn" style={{ background: 'var(--text-muted)', color: 'white' }}>X</button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <h2 className="stat-value primary">{formatRupees(budget)}</h2>
                <button onClick={() => setIsEditingBudget(true)} className="icon-btn edit">Edit</button>
              </div>
            )}
          </div>

          <div className="stat-card">
            <div className="stat-header">Spent in {selectedMonth}</div>
            <h2 className="stat-value warning">{formatRupees(totalSpent)}</h2>
          </div>

          <div className="stat-card" style={{ background: remainingBudget < 0 ? 'var(--danger-bg)' : 'var(--card-bg)' }}>
            <div className="stat-header" style={{ color: remainingBudget < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>Remaining Balance</div>
            <h2 className={`stat-value ${remainingBudget < 0 ? 'danger' : 'success'}`}>
              {formatRupees(remainingBudget)}
            </h2>
          </div>
        </div>

        {/* BUDGET PROGRESS BAR */}
        {budget > 0 && (
          <div className="progress-container">
            <div className="progress-header">
              <span style={{ color: 'var(--text-muted)' }}>Budget Utilization</span>
              <span style={{ color: progressPercentage > 90 ? 'var(--danger)' : 'var(--text-main)' }}>
                {progressPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="progress-track">
              <div 
                className="progress-fill" 
                style={{ 
                  width: `${progressPercentage}%`, 
                  backgroundColor: progressPercentage > 90 ? 'var(--danger)' : progressPercentage > 75 ? 'var(--warning)' : 'var(--primary)' 
                }}
              ></div>
            </div>
          </div>
        )}

        {/* FORM & CHART SECTION */}
        <div className="content-grid">
          {/* Form Card */}
          <div className="card">
            <h3 className="card-title">{editingId ? 'Edit Transaction' : 'Record New Expense'}</h3>
            <form onSubmit={handleSubmit} className="expense-form">
              <div className="form-row">
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" className="modern-input" value={date} onChange={e => setDate(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Category</label>
                  <select className="modern-input" value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="Food">Food & Dining</option>
                    <option value="Rent">Housing & Rent</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Description</label>
                <input type="text" className="modern-input" placeholder="e.g., Weekly Groceries" value={description} onChange={e => setDescription(e.target.value)} required />
              </div>
              
              <div>
                <label className="form-label">Amount (₹)</label>
                <input type="number" className="modern-input" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" min="0.01" required />
              </div>

              <div className="btn-group">
                <button type="submit" className={`primary-btn ${editingId ? 'edit-btn' : ''}`} style={{ flex: 2 }}>
                  {editingId ? 'Update Transaction' : 'Save Transaction'}
                </button>
                {editingId && (
                  <button type="button" className="secondary-btn" onClick={() => { setEditingId(null); setDescription(''); setAmount(''); setCategory('Food'); setDate(new Date().toISOString().split('T')[0]); }}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Chart Card */}
          <div className="card">
            <h3 className="card-title">Spending Analytics</h3>
            {filteredExpenses.length === 0 ? (
              <div style={{ display: 'flex', height: '250px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No analytics available for this month.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={getChartData()} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={5} dataKey="value" label={false}>
                    {getChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatRupees(value)}
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* RECENT TRANSACTIONS TABLE */}
        <div className="card">
          <h3 className="card-title">Recent Transactions</h3>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Syncing data...</p>
          ) : (
            <div className="table-container">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        No transactions found for {selectedMonth}.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <tr key={exp.id}>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ fontWeight: '600' }}>{exp.description}</td>
                        <td>
                          <span className="category-badge">{exp.category}</span>
                        </td>
                        <td className="amount-cell">{formatRupees(exp.amount)}</td>
                        <td>
                          <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                            <button onClick={() => startEdit(exp)} className="icon-btn edit">Edit</button>
                            <button onClick={() => deleteExpense(exp.id)} className="icon-btn delete">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;