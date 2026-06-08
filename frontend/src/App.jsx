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

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

  // Fetch data from backend when app loads
  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const response = await axios.get(`${API_URL}/api/expenses`);
    setExpenses(response.data);
  };

  // Add new expense
  const addExpense = async (e) => {
    e.preventDefault(); // Prevents page reload
    if (!description || !amount) return alert('Please fill in all fields');

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    await axios.post(`${API_URL}/api/expenses`, {
      description,
      amount: parseFloat(amount),
      category
    });

    setDescription('');
    setAmount('');
    fetchExpenses(); // Refresh the list
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
    const csv = Papa.unparse(expenses);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenses.csv';
    a.click();
  };

  // Export to PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Expense Report", 10, 10);
    expenses.forEach((exp, index) => {
      doc.text(`${exp.date} - ${exp.description} - $${exp.amount} (${exp.category})`, 10, 20 + (index * 10));
    });
    doc.save("expenses.pdf");
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: 'auto' }}>
      <h1>Smart Expense & Budget Tracker</h1>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        {/* Input Form */}
        <form onSubmit={addExpense} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '50%' }}>
          <h3>Add New Expense</h3>
          <input type="text" placeholder="Description (e.g., Groceries)" value={description} onChange={e => setDescription(e.target.value)} />
          <input type="number" placeholder="Amount (e.g., 50)" value={amount} onChange={e => setAmount(e.target.value)} />
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="Food">Food</option>
            <option value="Rent">Rent</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Utilities">Utilities</option>
            <option value="Other">Other</option>
          </select>
          <button type="submit" style={{ padding: '10px', background: 'blue', color: 'white', border: 'none' }}>Add Expense</button>
        </form>

        {/* Analytics Chart */}
        <div style={{ width: '50%' }}>
          <h3>Spending Analytics</h3>
          <PieChart width={300} height={250}>
            <Pie data={getChartData()} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
              {getChartData().map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </div>
      </div>

      {/* Export Buttons */}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={exportCSV} style={{ marginRight: '10px' }}>Export CSV</button>
        <button onClick={exportPDF}>Export PDF</button>
      </div>

      {/* Expense List */}
      <h3>Recent Expenses</h3>
      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid black' }}>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((exp) => (
            <tr key={exp.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td>{new Date(exp.date).toLocaleDateString()}</td>
              <td>{exp.description}</td>
              <td>{exp.category}</td>
              <td>${Number(exp.amount).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;