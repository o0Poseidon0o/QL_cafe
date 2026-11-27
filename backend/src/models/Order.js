const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: { type: String, required: true },
  variantName: { type: String, default: '' },
  scaleFactor: { type: Number, default: 1 },
  price: { type: Number, required: true },
  cost: { type: Number, default: 0 },
  quantity: { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderCode: { type: String, required: true, unique: true },
  items: [orderItemSchema],
  totalAmount: { type: Number, required: true, min: 0 },
  totalCost: { type: Number, default: 0 },
  paymentMethod: {
    type: String,
    enum: ['cash', 'transfer', 'card'],
    default: 'cash'
  },
  customerNote: { type: String, default: '' },
  status: {
    type: String,
    enum: ['completed', 'cancelled'],
    default: 'completed'
  }
}, { timestamps: true });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
