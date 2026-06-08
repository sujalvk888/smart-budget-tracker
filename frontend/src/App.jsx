import { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import Papa from 'papaparse';
import './App.css';

function App() {
  const [expenses, setExpenses] = useState([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [editingId, setEditingId] = useState(null); // Tracks if we are editing an expense

  // Budget State
  const [budget, setBudget] = useState(0);
  const [budgetInput, setBudgetInput] = useState('');
  const [isEditingBudget, setIsEditingBudget] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF6666'];
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [expensesRes, budgetRes] = await Promise.all([
        axios.get(`${API_URL}/api/expenses`),
        axios.get(`${API_URL}/api/settings/budget`)
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

  // Add or Update Expense
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description || !amount) return alert('Please fill in all fields');
    setErrorMsg('');

    try {
      if (editingId) {
        // Update existing
        await axios.put(`${API_URL}/api/expenses/${editingId}`, {
          description, amount: parseFloat(amount), category
        });
        setEditingId(null);
      } else {
        // Create new
        await axios.post(`${API_URL}/api/expenses`, {
          description, amount: parseFloat(amount), category
        });
      }

      setDescription('');
      setAmount('');
      setCategory('Food');
      fetchData(); // Refresh everything
    } catch (error) {
      console.error('Error saving expense:', error);
      setErrorMsg('Failed to save expense.');
    }
  };

  const deleteExpense = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await axios.delete(`${API_URL}/api/expenses/${id}`);
      fetchData();
    } catch (error) {
      console.error('Error deleting expense:', error);
      setErrorMsg('Failed to delete expense.');
    }
  };

  // Prepare Edit State
  const startEdit = (exp) => {
    setEditingId(exp.id);
    setDescription(exp.description);
    setAmount(exp.amount);
    setCategory(exp.category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setAmount('');
    setCategory('Food');
  };

  // Budget Update
  const updateBudget = async () => {
    if (budgetInput === '' || Number(budgetInput) < 0) return alert('Enter a valid budget');
    try {
      await axios.put(`${API_URL}/api/settings/budget`, { budget: Number(budgetInput) });
      setBudget(Number(budgetInput));
      setIsEditingBudget(false);
    } catch (error) {
      console.error('Error updating budget:', error);
      setErrorMsg('Failed to update budget.');
    }
  };

  // Financial Calculations
  const totalSpent = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const remainingBudget = budget - totalSpent;
  const progressPercentage = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;

  const getChartData = () => {
    const dataMap = {};
    expenses.forEach(exp => {
      dataMap[exp.category] = (dataMap[exp.category] || 0) + Number(exp.amount);
    });
    return Object.keys(dataMap).map(key => ({ name: key, value: dataMap[key] }));
  };

  // Exporters
  const exportCSV = () => {
    if (expenses.length === 0) return alert('No data to export!');
    const csv = Papa.unparse(expenses);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenses.csv';
    a.click();
  };

  const exportPDF = () => {
    if (expenses.length === 0) return alert('No data to export!');
    const doc = new jsPDF();
    doc.text("Expense Report", 10, 10);
    
    let y = 20;
    expenses.forEach((exp) => {
      if (y > 280) {
        doc.addPage();
        y = 20; 
      }
      doc.text(`${new Date(exp.date).toLocaleDateString()} - ${exp.description} - $${Number(exp.amount).toFixed(2)} (${exp.category})`, 10, y);
      y += 10;
    });
    doc.save("expenses.pdf");
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: 'auto' }}>
      <h1 style={{ textAlign: 'center', color: '#333' }}>Smart Expense & Budget Tracker</h1>

      {errorMsg && <div style={{ color: 'red', marginBottom: '15px', padding: '10px', background: '#ffe6e6', borderRadius: '5px' }}>{errorMsg}</div>}

      {/* DASHBOARD WIDGETS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        
        {/* Budget Card */}
        <div style={{ flex: 1, minWidth: '220px', padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>Monthly Budget</h4>
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

        {/* Total Spent Card */}
        <div style={{ flex: 1, minWidth: '220px', padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>Total Spent</h4>
          <h2 style={{ margin: '0', color: '#FF8042' }}>${totalSpent.toFixed(2)}</h2>
        </div>

        {/* Remaining Balance Card */}
        <div style={{ flex: 1, minWidth: '220px', padding: '20px', background: remainingBudget < 0 ? '#ffe6e6' : '#e6ffe6', borderRadius: '8px', border: `1px solid ${remainingBudget < 0 ? 'red' : '#28a745'}`, textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0', color: remainingBudget < 0 ? 'red' : '#28a745' }}>Remaining Balance</h4>
          <h2 style={{ margin: '0', color: remainingBudget < 0 ? 'red' : '#28a745' }}>${remainingBudget.toFixed(2)}</h2>
        </div>
      </div>

      {/* BUDGET PROGRESS BAR */}
      {budget > 0 && (
        <div style={{ marginBottom: '30px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold', color: '#555' }}>Budget Usage</span>
                <span style={{ fontWeight: 'bold', color: progressPercentage > 90 ? 'red' : '#555' }}>{progressPercentage.toFixed(1)}%</span>
            </div>
            <div style={{ width: '100%', background: '#e9ecef', height: '15px', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ width: `${progressPercentage}%`, background: progressPercentage > 90 ? '#dc3545' : progressPercentage > 75 ? '#fd7e14' : '#28a745', height: '100%', transition: 'width 0.4s ease-in-out' }}></div>
            </div>
        </div>
      )}

      {/* INPUT FORM & CHART */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
        
        {/* Form Card */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', minWidth: '300px', flex: 1, padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3 style={{ margin: '0 0 5px 0' }}>{editingId ? 'Edit Expense' : 'Add New Expense'}</h3>
          <input type="text" placeholder="Description (e.g., Groceries)" value={description} onChange={e => setDescription(e.target.value)} required style={{ padding: '8px' }}/>
          <input type="number" placeholder="Amount (e.g., 50)" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" min="0.01" required style={{ padding: '8px' }}/>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: '8px' }}>
            <option value="Food">Food</option>
            <option value="Rent">Rent</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Utilities">Utilities</option>
            <option value="Other">Other</option>
          </select>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" style={{ flex: 1, padding: '10px', background: editingId ? 'orange' : 'blue', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '5px', fontWeight: 'bold' }}>
              {editingId ? 'Update Expense' : 'Add Expense'}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} style={{ flex: 1, padding: '10px', background: 'gray', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '5px' }}>
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Analytics Card */}
        <div style={{ minWidth: '300px', flex: 1, padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ alignSelf: 'flex-start', margin: '0 0 10px 0' }}>Spending by Category</h3>
          {expenses.length === 0 ? (
            <p style={{ marginTop: '50px', color: '#777' }}>No expenses to chart yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={getChartData()} cx="50%" cy="50%" outerRadius={75} fill="#8884d8" dataKey="value" label>
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

      {/* EXPORTS & TABLE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>Recent Expenses</h3>
        <div>
            <button onClick={exportCSV} style={{ marginRight: '10px', padding: '6px 12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc' }}>Export CSV</button>
            <button onClick={exportPDF} style={{ padding: '6px 12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc' }}>Export PDF</button>
        </div>
      </div>
      
      {loading ? (
        <p>Loading data...</p>
      ) : (
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', background: 'white', border: '1px solid #ddd' }}>
          <thead style={{ background: '#f4f4f4' }}>
            <tr style={{ borderBottom: '2px solid #ccc' }}>
              <th style={{ padding: '12px 8px' }}>Date</th>
              <th style={{ padding: '12px 8px' }}>Description</th>
              <th style={{ padding: '12px 8px' }}>Category</th>
              <th style={{ padding: '12px 8px' }}>Amount</th>
              <th style={{ padding: '12px 8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#777' }}>No expenses recorded.</td>
              </tr>
            ) : (
              expenses.map((exp) => (
                <tr key={exp.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px 8px' }}>{new Date(exp.date).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 8px' }}>{exp.description}</td>
                  <td style={{ padding: '12px 8px' }}>{exp.category}</td>
                  <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>${Number(exp.amount).toFixed(2)}</td>
                  <td style={{ padding: '12px 8px', display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => startEdit(exp)} 
                      style={{ background: '#ffc107', color: 'black', border: 'none', padding: '6px 12px', cursor: 'pointer', borderRadius: '4px' }}>
                      Edit
                    </button>
                    <button 
                      onClick={() => deleteExpense(exp.id)} 
                      style={{ background: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', cursor: 'pointer', borderRadius: '4px' }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default App;