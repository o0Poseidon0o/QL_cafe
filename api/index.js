require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectToDatabase = require('../src/config/db');

const ingredientRoutes = require('../src/routes/ingredientRoutes');
const productRoutes = require('../src/routes/productRoutes');
const orderRoutes = require('../src/routes/orderRoutes');
const transactionRoutes = require('../src/routes/transactionRoutes');
const reportRoutes = require('../src/routes/reportRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Đảm bảo kết nối MongoDB Atlas trước mỗi request
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    console.error('Lỗi kết nối MongoDB Atlas:', err.message);
    res.status(500).json({
      error: 'Không thể kết nối cơ sở dữ liệu MongoDB Atlas',
      details: err.message
    });
  }
});

// API Routes
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'connected',
    environment: process.env.VERCEL ? 'vercel-serverless' : 'local-node',
    timestamp: new Date().toISOString()
  });
});

// Phục vụ frontend static khi chạy local
app.use(express.static(path.join(__dirname, '../public')));

// SPA fallback cho local
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Nếu chạy local (không phải Vercel serverless), khởi động server
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Webapp Quán Cafe đang chạy tại: http://localhost:${PORT}`);
  });
}

// Xuất app cho Vercel Serverless Function
module.exports = app;
