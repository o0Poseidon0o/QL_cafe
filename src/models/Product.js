const mongoose = require('mongoose');

const recipeItemSchema = new mongoose.Schema({
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

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên món bắt buộc'],
    trim: true,
    unique: true
  },
  category: {
    type: String,
    required: true,
    trim: true,
    default: 'Cà phê'
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  recipe: [recipeItemSchema],
  image: {
    type: String,
    default: '🥤'
  },
  description: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
