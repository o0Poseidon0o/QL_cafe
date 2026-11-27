const mongoose = require('mongoose');

const subRecipeItemSchema = new mongoose.Schema({
  ingredient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ingredient',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0.001
  }
}, { _id: false });

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
  // Quy cách mua vào (VD: 1 Bao = 1000g = 305.000đ)
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
  // Theo dõi tồn kho (đặt false cho Nước lọc, Đá bi, Nước luộc...)
  trackInventory: {
    type: Boolean,
    default: true
  },
  // Năng lượng ước tính cho 1 đơn vị cơ sở (VD: 3.2 kcal/g)
  kcalPerUnit: {
    type: Number,
    min: 0,
    default: 0
  },
  // Bán thành phẩm / Mẻ nấu (Sub-recipe: Nước cốt trà sữa, Sốt bắp, Trân châu...)
  isSubRecipe: {
    type: Boolean,
    default: false
  },
  yieldQuantity: {
    type: Number,
    min: 0,
    default: 0
  },
  wastePercent: {
    type: Number,
    min: 0,
    max: 90,
    default: 0
  },
  subRecipe: [subRecipeItemSchema],
  instructions: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.models.Ingredient || mongoose.model('Ingredient', ingredientSchema);
