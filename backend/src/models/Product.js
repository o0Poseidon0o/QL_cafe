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

const productVariantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  volumeMl: {
    type: Number,
    min: 0,
    default: 0
  },
  scaleFactor: {
    type: Number,
    min: 0.1,
    default: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  extraPackagingCost: {
    type: Number,
    min: 0,
    default: 0
  }
}, { _id: false });

const bottlingConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  bottleVolumeMl: { type: Number, min: 50, default: 330 },
  bottleCost: { type: Number, min: 0, default: 2000 },
  sellPricePerBottle: { type: Number, min: 0, default: 25000 }
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
  baseSizeLabel: {
    type: String,
    default: 'Ly 500ml',
    trim: true
  },
  baseVolumeMl: {
    type: Number,
    min: 0,
    default: 500
  },
  packagingCost: {
    type: Number,
    min: 0,
    default: 0
  },
  packagingNote: {
    type: String,
    default: 'Ly, muỗng, ống hút',
    trim: true
  },
  wastePercent: {
    type: Number,
    min: 0,
    max: 90,
    default: 0
  },
  targetCostPercent: {
    type: Number,
    min: 5,
    max: 95,
    default: 30
  },
  recipe: [recipeItemSchema],
  variants: [productVariantSchema],
  bottlingConfig: {
    type: bottlingConfigSchema,
    default: () => ({ enabled: false, bottleVolumeMl: 330, bottleCost: 2000, sellPricePerBottle: 25000 })
  },
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
