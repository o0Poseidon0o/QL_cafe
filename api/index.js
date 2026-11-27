require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectToDatabase = require('../backend/src/config/db');

const ingredientRoutes = require('../backend/src/routes/ingredientRoutes');
const productRoutes = require('../backend/src/routes/productRoutes');
const toppingRoutes = require('../backend/src/routes/toppingRoutes');
const orderRoutes = require('../backend/src/routes/orderRoutes');
const transactionRoutes = require('../backend/src/routes/transactionRoutes');
const reportRoutes = require('../backend/src/routes/reportRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware kết nối MongoDB Atlas cho Vercel Serverless
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    console.error('Lỗi kết nối MongoDB Atlas:', err.message);
    res.status(500).json({ error: 'Không thể kết nối MongoDB Atlas', details: err.message });
  }
});

// Routes API
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/toppings', toppingRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'connected',
    provider: 'vercel-serverless',
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
