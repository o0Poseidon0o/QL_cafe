const mongoose = require('mongoose');

const toppingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên topping bắt buộc'],
    trim: true,
    unique: true
  },
  ingredient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ingredient',
    required: [true, 'Vui lòng chọn nguyên liệu liên kết trong kho']
  },
  quantity: {
    type: Number,
    required: [true, 'Định lượng 1 phần thêm bắt buộc'],
    min: 0.001
  },
  price: {
    type: Number,
    required: [true, 'Giá bán thêm bắt buộc'],
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.models.Topping || mongoose.model('Topping', toppingSchema);
