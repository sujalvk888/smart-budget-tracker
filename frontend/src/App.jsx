import { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import jsPDF from 'jspdf';
import Papa from 'papaparse';
import './App.css';

function App() {
  const [expenses, setExpenses] = useState([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Fetch data from backend when app loads
  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await axios.get(`${API_URL}/api/expenses`);
      setExpenses(response.data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      setErrorMsg('Failed to load expenses. Please ensure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  // Add new expense
  const addExpense = async (e) => {
    e.preventDefault();
    if (!description || !amount) return alert('Please fill in all fields');
    setErrorMsg('');

    try {
      await axios.post(`${API_URL}/api/expenses`, {
        description,
        amount: parseFloat(amount),
        category
      });

      setDescription('');
      setAmount('');
      fetchExpenses(); // Refresh the list
    } catch (error) {
      console.error('Error adding expense:', error);
      setErrorMsg('Failed to add expense.');
    }
  };

  // Delete expense
  const deleteExpense = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    setErrorMsg('');

    try {
      await axios.delete(`${API_URL}/api/expenses/${id}`);
      fetchExpenses(); // Refresh the list after deletion
    } catch (error) {
      console.error('Error deleting expense:', error);
      setErrorMsg('Failed to delete expense.');
    }
  };

  // Group data for the Pie Chart
  const getChartData = () => {
    const dataMap = {};
    expenses.forEach(exp => {
      dataMap[exp.category] = (dataMap[exp.category] || 0) + Number(exp.amount);
    });
    return Object.keys(dataMap).map(key => ({ name: key, value: dataMap[key] }));
  };

  // Export to CSV
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

  // Export to PDF (Fixed pagination bug)
  const exportPDF = () => {
    if (expenses.length === 0) return alert('No data to export!');
    const doc = new jsPDF();
    doc.text("Expense Report", 10, 10);
    
    let y = 20;
    expenses.forEach((exp) => {
      // Create a new page if the text runs too low
      if (y > 280) {
        doc.addPage();
        y = 20; 
      }
      const formattedDate = new Date(exp.date).toLocaleDateString();
      const formattedAmount = Number(exp.amount).toFixed(2);
      doc.text(`${formattedDate} - ${exp.description} - $${formattedAmount} (${exp.category})`, 10, y);
      y += 10;
    });
    
    doc.save("expenses.pdf");
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: 'auto' }}>
      <h1>Smart Expense & Budget Tracker</h1>

      {errorMsg && <div style={{ color: 'red', marginBottom: '15px', padding: '10px', background: '#ffe6e6', borderRadius: '5px' }}>{errorMsg}</div>}

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
        {/* Input Form */}
        <form onSubmit={addExpense} style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '300px', flex: 1 }}>
          <h3>Add New Expense</h3>
          <input type="text" placeholder="Description (e.g., Groceries)" value={description} onChange={e => setDescription(e.target.value)} required />
          <input type="number" placeholder="Amount (e.g., 50)" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" min="0.01" required />
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="Food">Food</option>
            <option value="Rent">Rent</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Utilities">Utilities</option>
            <option value="Other">Other</option>
          </select>
          <button type="submit" style={{ padding: '10px', background: 'blue', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '5px' }}>Add Expense</button>
        </form>

        {/* Analytics Chart */}
        <div style={{ minWidth: '300px', flex: 1 }}>
          <h3>Spending Analytics</h3>
          {expenses.length === 0 ? (
            <p>No expenses to chart yet.</p>
          ) : (
            <PieChart width={300} height={250}>
              <Pie data={getChartData()} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
                {getChartData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
              <Legend />
            </PieChart>
          )}
        </div>
      </div>

      {/* Export Buttons */}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={exportCSV} style={{ marginRight: '10px', padding: '8px', cursor: 'pointer' }}>Export CSV</button>
        <button onClick={exportPDF} style={{ padding: '8px', cursor: 'pointer' }}>Export PDF</button>
      </div>

      {/* Expense List */}
      <h3>Recent Expenses</h3>
      {loading ? (
        <p>Loading expenses...</p>
      ) : (
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid black' }}>
              <th style={{ padding: '8px' }}>Date</th>
              <th style={{ padding: '8px' }}>Description</th>
              <th style={{ padding: '8px' }}>Category</th>
              <th style={{ padding: '8px' }}>Amount</th>
              <th style={{ padding: '8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No expenses recorded.</td>
              </tr>
            ) : (
              expenses.map((exp) => (
                <tr key={exp.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '8px' }}>{new Date(exp.date).toLocaleDateString()}</td>
                  <td style={{ padding: '8px' }}>{exp.description}</td>
                  <td style={{ padding: '8px' }}>{exp.category}</td>
                  <td style={{ padding: '8px' }}>${Number(exp.amount).toFixed(2)}</td>
                  <td style={{ padding: '8px' }}>
                    <button 
                      onClick={() => deleteExpense(exp.id)} 
                      style={{ background: 'red', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer', borderRadius: '3px' }}>
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