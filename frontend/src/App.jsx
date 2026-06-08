import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import Papa from 'papaparse';
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

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF6666'];
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // --- API CONFIG ---
  // Attach JWT Token to every request
  const getHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  // Auto-fetch data if logged in
  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  // Handle unauthorized errors (Token expired)
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
        // Registration successful, switch to login
        setIsLoginMode(true);
        setAuthError('Registration successful! Please log in.');
      }
    } catch (error) {
      setAuthError(error.response?.data?.error || 'An error occurred. Try again.');
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

  // --- CALCULATIONS & EXPORTS ---
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

  // --------------------------------------------------------
  // RENDER AUTHENTICATION PAGE
  // --------------------------------------------------------
  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <h2 style={{ color: '#333', marginBottom: '10px' }}>Smart Budget</h2>
          <p style={{ color: '#666', marginBottom: '25px' }}>
            {isLoginMode ? 'Welcome back! Please login.' : 'Create a new account.'}
          </p>

          {authError && (
            <div style={{ background: authError.includes('successful') ? '#d4edda' : '#f8d7da', color: authError.includes('successful') ? '#155724' : '#721c24', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '14px' }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input 
              type="text" 
              placeholder="Username" 
              value={authUsername} 
              onChange={(e) => setAuthUsername(e.target.value)} 
              required 
              style={{ padding: '12px', fontSize: '15px', borderRadius: '5px', border: '1px solid #ccc', outline: 'none' }}
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={authPassword} 
              onChange={(e) => setAuthPassword(e.target.value)} 
              required 
              style={{ padding: '12px', fontSize: '15px', borderRadius: '5px', border: '1px solid #ccc', outline: 'none' }}
            />
            <button type="submit" style={{ padding: '12px', background: '#0088FE', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
              {isLoginMode ? 'Login' : 'Sign Up'}
            </button>
          </form>

          <p style={{ marginTop: '20px', fontSize: '14px', color: '#555' }}>
            {isLoginMode ? "Don't have an account? " : "Already have an account? "}
            <span 
              onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }} 
              style={{ color: '#0088FE', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {isLoginMode ? 'Sign Up' : 'Login'}
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
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1000px', margin: 'auto' }}>
      
      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 style={{ margin: 0, color: '#333', fontSize: '24px' }}>Smart Expense Tracker</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontWeight: 'bold', color: '#555' }}>👤 {user}</span>
          <button onClick={handleLogout} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', cursor: 'pointer', borderRadius: '4px' }}>Logout</button>
        </div>
      </header>

      {errorMsg && <div style={{ color: 'red', marginBottom: '15px', padding: '10px', background: '#ffe6e6', borderRadius: '5px' }}>{errorMsg}</div>}

      {/* MONTH SELECTOR */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ fontWeight: 'bold' }}>Viewing Data For: </label>
        <input 
          type="month" 
          value={selectedMonth} 
          onChange={(e) => setSelectedMonth(e.target.value)} 
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer' }}
        />
      </div>

      {/* DASHBOARD WIDGETS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px', padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>Target Monthly Budget</h4>
          {isEditingBudget ? (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}>
              <input type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} style={{ width: '80px', padding: '5px' }} />
              <button onClick={updateBudget} style={{ background: '#28a745', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer', borderRadius: '3px' }}>Save</button>
              <button onClick={() => setIsEditingBudget(false)} style={{ background: '#6c757d', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer', borderRadius: '3px' }}>X</button>
            </div>
          ) : (
            <div>
              <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>${budget.toFixed(2)}</h2>
              <button onClick={() => setIsEditingBudget(true)} style={{ background: '#0088FE', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}>Edit Budget</button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: '220px', padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>Spent in {selectedMonth}</h4>
          <h2 style={{ margin: '0', color: '#FF8042' }}>${totalSpent.toFixed(2)}</h2>
        </div>

        <div style={{ flex: 1, minWidth: '220px', padding: '20px', background: remainingBudget < 0 ? '#ffe6e6' : '#e6ffe6', borderRadius: '8px', border: `1px solid ${remainingBudget < 0 ? 'red' : '#28a745'}`, textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0', color: remainingBudget < 0 ? 'red' : '#28a745' }}>Remaining Balance</h4>
          <h2 style={{ margin: '0', color: remainingBudget < 0 ? 'red' : '#28a745' }}>${remainingBudget.toFixed(2)}</h2>
        </div>
      </div>

      {/* BUDGET PROGRESS BAR */}
      {budget > 0 && (
        <div style={{ marginBottom: '30px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold', color: '#555' }}>Budget Usage ({selectedMonth})</span>
                <span style={{ fontWeight: 'bold', color: progressPercentage > 90 ? 'red' : '#555' }}>{progressPercentage.toFixed(1)}%</span>
            </div>
            <div style={{ width: '100%', background: '#e9ecef', height: '15px', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ width: `${progressPercentage}%`, background: progressPercentage > 90 ? '#dc3545' : progressPercentage > 75 ? '#fd7e14' : '#28a745', height: '100%', transition: 'width 0.4s ease-in-out' }}></div>
            </div>
        </div>
      )}

      {/* INPUT FORM & CHART */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', minWidth: '300px', flex: 1, padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3 style={{ margin: '0 0 5px 0' }}>{editingId ? 'Edit Expense' : 'Add New Expense'}</h3>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}/>
          <input type="text" placeholder="Description (e.g., Groceries)" value={description} onChange={e => setDescription(e.target.value)} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}/>
          <input type="number" placeholder="Amount (e.g., 50)" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" min="0.01" required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}/>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
            <option value="Food">Food</option>
            <option value="Rent">Rent</option>
            <option value="Transportation">Transportation</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Utilities">Utilities</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Shopping">Shopping</option>
            <option value="Other">Other</option>
          </select>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" style={{ flex: 1, padding: '10px', background: editingId ? 'orange' : '#28a745', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '5px', fontWeight: 'bold' }}>
              {editingId ? 'Update Expense' : 'Save Expense'}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setDescription(''); setAmount(''); setCategory('Food'); setDate(new Date().toISOString().split('T')[0]); }} style={{ flex: 1, padding: '10px', background: 'gray', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '5px' }}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div style={{ minWidth: '300px', flex: 1, padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ alignSelf: 'flex-start', margin: '0 0 10px 0' }}>Spending by Category ({selectedMonth})</h3>
          {filteredExpenses.length === 0 ? (
            <p style={{ marginTop: '50px', color: '#777' }}>No expenses to chart for this month.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={getChartData()} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
                  {getChartData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* TABLE */}
      {loading ? (
        <p>Loading data...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', background: 'white', border: '1px solid #ddd', minWidth: '600px' }}>
            <thead style={{ background: '#f4f4f4' }}>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: '12px 8px' }}>Date</th>
                <th style={{ padding: '12px 8px' }}>Description</th>
                <th style={{ padding: '12px 8px' }}>Category</th>
                <th style={{ padding: '12px 8px' }}>Amount</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#777' }}>No expenses recorded for this month.</td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px 8px' }}>{new Date(exp.date).toLocaleDateString()}</td>
                    <td style={{ padding: '12px 8px' }}>{exp.description}</td>
                    <td style={{ padding: '12px 8px' }}>{exp.category}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>${Number(exp.amount).toFixed(2)}</td>
                    <td style={{ padding: '12px 8px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button onClick={() => startEdit(exp)} style={{ background: '#ffc107', color: 'black', border: 'none', padding: '6px 12px', cursor: 'pointer', borderRadius: '4px' }}>Edit</button>
                      <button onClick={() => deleteExpense(exp.id)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', cursor: 'pointer', borderRadius: '4px' }}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;