const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên nguyên liệu bắt buộc'],
    trim: true,
    unique: true
  },
  unit: {
    type: String,
    required: [true, 'Đơn vị tính bắt buộc'],
    trim: true
  },
  category: {
    type: String,
    default: 'Nguyên liệu chính',
    trim: true
  },
  costPerUnit: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  stockQuantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  minStockAlert: {
    type: Number,
    min: 0,
    default: 50
  },
  purchaseUnit: {
    type: String,
    default: '',
    trim: true
  },
  conversionRate: {
    type: Number,
    min: 0,
    default: 1
  },
  purchasePrice: {
    type: Number,
    min: 0,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.models.Ingredient || mongoose.model('Ingredient', ingredientSchema);
