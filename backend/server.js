require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectToDatabase = require('./src/config/db');

const ingredientRoutes = require('./src/routes/ingredientRoutes');
const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const transactionRoutes = require('./src/routes/transactionRoutes');
const reportRoutes = require('./src/routes/reportRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection middleware
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    console.error('Lỗi kết nối MongoDB Atlas:', err.message);
    res.status(500).json({ error: 'Không thể kết nối MongoDB Atlas', details: err.message });
  }
});

// API Routes
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backend Express đang chạy tại: http://localhost:${PORT}`);
});

module.exports = app;
