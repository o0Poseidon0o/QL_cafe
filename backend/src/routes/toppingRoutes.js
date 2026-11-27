const express = require('express');
const router = express.Router();
const Topping = require('../models/Topping');
const { formatSpecPrice } = require('../utils/costing');

function formatToppingStats(t) {
  const obj = t.toObject();
  const ing = t.ingredient && typeof t.ingredient === 'object' ? t.ingredient : null;
  const qty = Number(t.quantity) || 0;
  const unitCost = ing ? (Number(ing.costPerUnit) || 0) : 0;
  const costPrice = Math.round(qty * unitCost);
  const kcal = ing ? Math.round(qty * (Number(ing.kcalPerUnit) || 0)) : 0;
  const price = Number(t.price) || 0;
  const grossProfit = price - costPrice;
  const profitMargin = price > 0 ? Math.round((grossProfit / price) * 100) : 0;
  const trackInventory = ing ? ing.trackInventory !== false : false;
  const currentStock = ing ? (Number(ing.stockQuantity) || 0) : 0;
  const maxPortionsPossible = !trackInventory
    ? 999
    : (qty > 0 && currentStock > 0 ? Math.floor(currentStock / qty) : 0);

  return {
    ...obj,
    ingredientId: ing ? ing._id : t.ingredient,
    ingredientName: ing ? ing.name : 'Không rõ',
    unit: ing ? ing.unit : '',
    specPrice: ing ? formatSpecPrice(ing) : '-',
    costPerUnit: unitCost,
    trackInventory,
    currentStock,
    costPrice,
    kcal,
    grossProfit,
    profitMargin,
    maxPortionsPossible
  };
}

router.get('/', async (req, res) => {
  try {
    const toppings = await Topping.find().populate('ingredient').sort({ name: 1 });
    res.json(toppings.map(formatToppingStats));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách topping', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, ingredient, quantity, price, notes, isActive } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Vui lòng nhập tên topping' });
    if (!ingredient) return res.status(400).json({ message: 'Vui lòng chọn nguyên liệu liên kết trong kho' });

    const existing = await Topping.findOne({ name: name.trim() });
    if (existing) return res.status(400).json({ message: 'Tên topping này đã tồn tại!' });

    const topping = new Topping({
      name: name.trim(),
      ingredient,
      quantity: Number(quantity),
      price: Number(price),
      notes: notes || '',
      isActive: isActive !== false
    });

    await topping.save();
    const populated = await Topping.findById(topping._id).populate('ingredient');
    res.status(201).json(formatToppingStats(populated));
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi tạo topping', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, ingredient, quantity, price, notes, isActive } = req.body;
    const topping = await Topping.findById(req.params.id);
    if (!topping) return res.status(404).json({ message: 'Không tìm thấy topping' });

    if (name !== undefined) topping.name = name.trim();
    if (ingredient !== undefined) topping.ingredient = ingredient;
    if (quantity !== undefined) topping.quantity = Number(quantity);
    if (price !== undefined) topping.price = Number(price);
    if (notes !== undefined) topping.notes = notes;
    if (isActive !== undefined) topping.isActive = !!isActive;

    await topping.save();
    const populated = await Topping.findById(topping._id).populate('ingredient');
    res.json(formatToppingStats(populated));
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi cập nhật topping', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Topping.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa topping thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa topping', error: error.message });
  }
});

module.exports = router;
