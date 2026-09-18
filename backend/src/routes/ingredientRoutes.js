const express = require('express');
const router = express.Router();
const Ingredient = require('../models/Ingredient');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');

// Lấy danh sách nguyên liệu
router.get('/', async (req, res) => {
  try {
    const ingredients = await Ingredient.find().sort({ name: 1 });
    const formatted = ingredients.map(ing => ({
      ...ing.toObject(),
      isLowStock: ing.stockQuantity <= ing.minStockAlert,
      totalInventoryValue: Math.round(ing.stockQuantity * ing.costPerUnit)
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách nguyên liệu', error: error.message });
  }
});

// Thêm nguyên liệu mới
router.post('/', async (req, res) => {
  try {
    const { name, unit, category, costPerUnit, stockQuantity, minStockAlert, notes, purchaseUnit, conversionRate, purchasePrice } = req.body;
    
    const existing = await Ingredient.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: 'Nguyên liệu này đã tồn tại!' });
    }

    const ingredient = new Ingredient({
      name: name.trim(),
      unit: unit.trim(),
      category: category ? category.trim() : 'Nguyên liệu chính',
      costPerUnit: Number(costPerUnit) || 0,
      stockQuantity: Number(stockQuantity) || 0,
      minStockAlert: Number(minStockAlert) || 50,
      purchaseUnit: purchaseUnit ? purchaseUnit.trim() : '',
      conversionRate: Number(conversionRate) > 0 ? Number(conversionRate) : 1,
      purchasePrice: Number(purchasePrice) || 0,
      notes: notes || ''
    });

    await ingredient.save();

    if (ingredient.stockQuantity > 0 && ingredient.costPerUnit > 0) {
      await Transaction.create({
        type: 'expense',
        category: 'Nhập nguyên liệu',
        amount: Math.round(ingredient.stockQuantity * ingredient.costPerUnit),
        description: `Tạo nguyên liệu ban đầu: ${ingredient.name} (${ingredient.stockQuantity} ${ingredient.unit})`,
        relatedIngredient: ingredient._id
      });
    }

    res.status(201).json(ingredient);
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi tạo nguyên liệu', error: error.message });
  }
});

// Cập nhật nguyên liệu
router.put('/:id', async (req, res) => {
  try {
    const { name, unit, category, costPerUnit, minStockAlert, notes, purchaseUnit, conversionRate, purchasePrice } = req.body;
    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) return res.status(404).json({ message: 'Không tìm thấy nguyên liệu' });

    if (name !== undefined) ingredient.name = name.trim();
    if (unit !== undefined) ingredient.unit = unit.trim();
    if (category !== undefined) ingredient.category = category.trim();
    if (costPerUnit !== undefined) ingredient.costPerUnit = Number(costPerUnit);
    if (minStockAlert !== undefined) ingredient.minStockAlert = Number(minStockAlert);
    if (notes !== undefined) ingredient.notes = notes;
    if (purchaseUnit !== undefined) ingredient.purchaseUnit = purchaseUnit.trim();
    if (conversionRate !== undefined) ingredient.conversionRate = Number(conversionRate) > 0 ? Number(conversionRate) : 1;
    if (purchasePrice !== undefined) ingredient.purchasePrice = Number(purchasePrice) || 0;

    await ingredient.save();
    res.json(ingredient);
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi cập nhật nguyên liệu', error: error.message });
  }
});

// Nhập kho nguyên liệu
router.post('/:id/import', async (req, res) => {
  try {
    const { quantity, costPerUnit, totalCost, notes, purchasePrice } = req.body;
    const importQty = Number(quantity);
    if (!importQty || importQty <= 0) return res.status(400).json({ message: 'Số lượng phải lớn hơn 0' });

    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) return res.status(404).json({ message: 'Không tìm thấy nguyên liệu' });

    const unitPrice = costPerUnit ? Number(costPerUnit) : (totalCost ? Number(totalCost) / importQty : ingredient.costPerUnit);
    const calculatedTotalCost = totalCost ? Number(totalCost) : Math.round(importQty * unitPrice);

    // Tính giá vốn bình quân gia quyền mới
    const oldTotalValue = ingredient.stockQuantity * ingredient.costPerUnit;
    const newTotalQty = ingredient.stockQuantity + importQty;
    const newCostPerUnit = Math.round((oldTotalValue + calculatedTotalCost) / newTotalQty);

    ingredient.stockQuantity = newTotalQty;
    ingredient.costPerUnit = newCostPerUnit;
    if (purchasePrice !== undefined && Number(purchasePrice) > 0) {
      ingredient.purchasePrice = Number(purchasePrice);
    }
    await ingredient.save();

    const transaction = await Transaction.create({
      type: 'expense',
      category: 'Nhập nguyên liệu',
      amount: calculatedTotalCost,
      description: `Nhập kho ${importQty} ${ingredient.unit} ${ingredient.name} (${unitPrice.toLocaleString()}đ/${ingredient.unit})${notes ? ' - ' + notes : ''}`,
      relatedIngredient: ingredient._id
    });

    res.json({ message: 'Nhập kho thành công', ingredient, transaction });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi nhập kho', error: error.message });
  }
});

// Xóa nguyên liệu
router.delete('/:id', async (req, res) => {
  try {
    const usedInProducts = await Product.find({ 'recipe.ingredient': req.params.id });
    if (usedInProducts.length > 0) {
      return res.status(400).json({
        message: `Không thể xóa nguyên liệu này vì đang dùng trong món: ${usedInProducts.map(p => p.name).join(', ')}`
      });
    }
    await Ingredient.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa nguyên liệu thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa nguyên liệu', error: error.message });
  }
});

module.exports = router;
