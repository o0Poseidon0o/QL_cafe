const express = require('express');
const router = express.Router();
const Ingredient = require('../models/Ingredient');
const Product = require('../models/Product');
const Topping = require('../models/Topping');
const Transaction = require('../models/Transaction');
const { round4, formatSpecPrice, computeSubRecipeMetrics, syncAllSubRecipes } = require('../utils/costing');

// Lấy danh sách nguyên liệu & bán thành phẩm
router.get('/', async (req, res) => {
  try {
    const ingredients = await Ingredient.find()
      .populate('subRecipe.ingredient')
      .sort({ isSubRecipe: 1, name: 1 });

    const ingMap = new Map(ingredients.map(i => [i._id.toString(), i]));

    // Map xem mỗi nguyên liệu đang được dùng trong bán thành phẩm nào
    const usedInSubMap = new Map();
    for (const ing of ingredients) {
      if (ing.isSubRecipe && Array.isArray(ing.subRecipe)) {
        for (const r of ing.subRecipe) {
          const childId = r.ingredient ? (r.ingredient._id || r.ingredient).toString() : null;
          if (!childId) continue;
          if (!usedInSubMap.has(childId)) usedInSubMap.set(childId, []);
          usedInSubMap.get(childId).push(ing.name);
        }
      }
    }

    const formatted = ingredients.map(ing => {
      const obj = ing.toObject();
      const trackInv = ing.trackInventory !== false;
      const isLowStock = trackInv && ing.stockQuantity <= ing.minStockAlert;
      const totalInventoryValue = trackInv ? Math.round(ing.stockQuantity * (ing.costPerUnit || 0)) : 0;

      let subRecipeMetrics = null;
      if (ing.isSubRecipe) {
        subRecipeMetrics = computeSubRecipeMetrics(ing, ingMap);
      }

      return {
        ...obj,
        trackInventory: trackInv,
        specPrice: formatSpecPrice(ing),
        isLowStock,
        totalInventoryValue,
        usedInSubRecipes: usedInSubMap.get(ing._id.toString()) || [],
        subRecipeMetrics
      };
    });

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách nguyên liệu', error: error.message });
  }
});

// Thêm nguyên liệu hoặc bán thành phẩm mới
router.post('/', async (req, res) => {
  try {
    const {
      name, unit, category, costPerUnit, stockQuantity, minStockAlert, notes,
      purchaseUnit, conversionRate, purchasePrice,
      trackInventory, kcalPerUnit,
      isSubRecipe, yieldQuantity, wastePercent, subRecipe, instructions
    } = req.body;

    const existing = await Ingredient.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: 'Nguyên liệu / Bán thành phẩm này đã tồn tại!' });
    }

    const formattedSubRecipe = isSubRecipe && Array.isArray(subRecipe)
      ? subRecipe
          .filter(r => r.ingredient && Number(r.quantity) > 0)
          .map(r => ({ ingredient: r.ingredient, quantity: Number(r.quantity) }))
      : [];

    const ingredient = new Ingredient({
      name: name.trim(),
      unit: unit.trim(),
      category: category ? category.trim() : (isSubRecipe ? 'Bán thành phẩm (Mẻ)' : 'Nguyên liệu chính'),
      costPerUnit: round4(costPerUnit),
      stockQuantity: trackInventory === false ? 0 : (Number(stockQuantity) || 0),
      minStockAlert: trackInventory === false ? 0 : (Number(minStockAlert) || 50),
      purchaseUnit: isSubRecipe ? (purchaseUnit?.trim() || 'Mẻ') : (purchaseUnit ? purchaseUnit.trim() : ''),
      conversionRate: isSubRecipe
        ? (Number(yieldQuantity) > 0 ? Number(yieldQuantity) : 1)
        : (Number(conversionRate) > 0 ? Number(conversionRate) : 1),
      purchasePrice: Number(purchasePrice) || 0,
      trackInventory: trackInventory !== false,
      kcalPerUnit: round4(kcalPerUnit),
      isSubRecipe: !!isSubRecipe,
      yieldQuantity: isSubRecipe ? (Number(yieldQuantity) || 0) : 0,
      wastePercent: Number(wastePercent) || 0,
      subRecipe: formattedSubRecipe,
      instructions: instructions || '',
      notes: notes || ''
    });

    await ingredient.save();
    await syncAllSubRecipes();

    const saved = await Ingredient.findById(ingredient._id).populate('subRecipe.ingredient');

    if (!saved.isSubRecipe && saved.trackInventory !== false && saved.stockQuantity > 0 && saved.costPerUnit > 0) {
      await Transaction.create({
        type: 'expense',
        category: 'Nhập nguyên liệu',
        amount: Math.round(saved.stockQuantity * saved.costPerUnit),
        description: `Tạo nguyên liệu ban đầu: ${saved.name} (${saved.stockQuantity} ${saved.unit})`,
        relatedIngredient: saved._id
      });
    }

    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi tạo nguyên liệu', error: error.message });
  }
});

// Cập nhật nguyên liệu hoặc bán thành phẩm
router.put('/:id', async (req, res) => {
  try {
    const {
      name, unit, category, costPerUnit, stockQuantity, minStockAlert, notes,
      purchaseUnit, conversionRate, purchasePrice,
      trackInventory, kcalPerUnit,
      isSubRecipe, yieldQuantity, wastePercent, subRecipe, instructions
    } = req.body;

    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) return res.status(404).json({ message: 'Không tìm thấy nguyên liệu' });

    if (name !== undefined) ingredient.name = name.trim();
    if (unit !== undefined) ingredient.unit = unit.trim();
    if (category !== undefined) ingredient.category = category.trim();
    if (costPerUnit !== undefined) ingredient.costPerUnit = round4(costPerUnit);
    if (stockQuantity !== undefined) ingredient.stockQuantity = Number(stockQuantity) || 0;
    if (minStockAlert !== undefined) ingredient.minStockAlert = Number(minStockAlert) || 0;
    if (notes !== undefined) ingredient.notes = notes;
    if (purchaseUnit !== undefined) ingredient.purchaseUnit = purchaseUnit.trim();
    if (conversionRate !== undefined) ingredient.conversionRate = Number(conversionRate) > 0 ? Number(conversionRate) : 1;
    if (purchasePrice !== undefined) ingredient.purchasePrice = Number(purchasePrice) || 0;
    if (trackInventory !== undefined) ingredient.trackInventory = !!trackInventory;
    if (kcalPerUnit !== undefined) ingredient.kcalPerUnit = round4(kcalPerUnit);
    if (isSubRecipe !== undefined) ingredient.isSubRecipe = !!isSubRecipe;
    if (yieldQuantity !== undefined) ingredient.yieldQuantity = Number(yieldQuantity) || 0;
    if (wastePercent !== undefined) ingredient.wastePercent = Number(wastePercent) || 0;
    if (instructions !== undefined) ingredient.instructions = instructions;
    if (subRecipe !== undefined && Array.isArray(subRecipe)) {
      ingredient.subRecipe = subRecipe
        .filter(r => r.ingredient && Number(r.quantity) > 0 && r.ingredient.toString() !== req.params.id)
        .map(r => ({ ingredient: r.ingredient, quantity: Number(r.quantity) }));
    }

    await ingredient.save();
    const updatedSubRecipes = await syncAllSubRecipes();
    const updated = await Ingredient.findById(ingredient._id).populate('subRecipe.ingredient');

    res.json({ ...updated.toObject(), updatedSubRecipes });
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi cập nhật nguyên liệu', error: error.message });
  }
});

// Nhập kho nguyên liệu (hỗ trợ giữ 4 chữ số thập phân chính xác & tự đồng bộ bán thành phẩm)
router.post('/:id/import', async (req, res) => {
  try {
    const { quantity, costPerUnit, totalCost, notes, purchasePrice, purchaseUnit, conversionRate } = req.body;
    const importQty = Number(quantity);
    if (!importQty || importQty <= 0) return res.status(400).json({ message: 'Số lượng nhập phải lớn hơn 0' });

    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) return res.status(404).json({ message: 'Không tìm thấy nguyên liệu' });

    const calculatedTotalCost = totalCost !== undefined && Number(totalCost) >= 0
      ? Math.round(Number(totalCost))
      : Math.round(importQty * (Number(costPerUnit) || ingredient.costPerUnit || 0));

    const unitPrice = importQty > 0 ? round4(calculatedTotalCost / importQty) : (Number(costPerUnit) || ingredient.costPerUnit);

    // Tính giá vốn bình quân gia quyền mới (giữ 4 chữ số thập phân tránh sai số chia lẻ)
    const oldStock = Math.max(0, Number(ingredient.stockQuantity) || 0);
    const oldTotalValue = oldStock * (Number(ingredient.costPerUnit) || 0);
    const newTotalQty = Math.round((oldStock + importQty) * 100) / 100;
    const newCostPerUnit = newTotalQty > 0 ? round4((oldTotalValue + calculatedTotalCost) / newTotalQty) : unitPrice;

    ingredient.stockQuantity = newTotalQty;
    ingredient.costPerUnit = newCostPerUnit;
    if (purchaseUnit) ingredient.purchaseUnit = purchaseUnit.trim();
    if (conversionRate && Number(conversionRate) > 0) ingredient.conversionRate = Number(conversionRate);
    if (purchasePrice !== undefined && Number(purchasePrice) > 0) {
      ingredient.purchasePrice = Math.round(Number(purchasePrice));
    } else if (ingredient.conversionRate > 1 && unitPrice > 0) {
      ingredient.purchasePrice = Math.round(unitPrice * ingredient.conversionRate);
    }

    await ingredient.save();

    // Tự động cập nhật lại giá vốn cho tất cả bán thành phẩm dùng nguyên liệu này
    const updatedSubRecipes = await syncAllSubRecipes();

    let transaction = null;
    if (calculatedTotalCost > 0) {
      transaction = await Transaction.create({
        type: 'expense',
        category: 'Nhập nguyên liệu',
        amount: calculatedTotalCost,
        description: `Nhập kho ${importQty.toLocaleString('vi-VN')} ${ingredient.unit} ${ingredient.name} (${unitPrice.toLocaleString('vi-VN')}đ/${ingredient.unit})${notes ? ' - ' + notes : ''}`,
        relatedIngredient: ingredient._id
      });
    }

    res.json({
      message: 'Nhập kho thành công',
      ingredient,
      transaction,
      updatedSubRecipes
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi nhập kho', error: error.message });
  }
});

// Nấu mẻ bán thành phẩm: tự trừ kho nguyên liệu thô và cộng thành phẩm vào kho
router.post('/:id/cook-batch', async (req, res) => {
  try {
    const { batches = 1, actualYield, notes = '' } = req.body;
    const batchCount = Number(batches);
    if (!batchCount || batchCount <= 0) {
      return res.status(400).json({ message: 'Số mẻ nấu phải lớn hơn 0' });
    }

    const subIng = await Ingredient.findById(req.params.id).populate('subRecipe.ingredient');
    if (!subIng || !subIng.isSubRecipe) {
      return res.status(404).json({ message: 'Không tìm thấy bán thành phẩm này' });
    }

    const addedQty = actualYield && Number(actualYield) > 0
      ? Number(actualYield)
      : Math.round((subIng.yieldQuantity || 0) * batchCount * 100) / 100;

    if (addedQty <= 0) {
      return res.status(400).json({ message: 'Thành phẩm thu được phải lớn hơn 0' });
    }

    const warnings = [];
    const deductions = [];

    for (const row of (subIng.subRecipe || [])) {
      const child = row.ingredient;
      if (!child || child.trackInventory === false) continue;

      const needed = Math.round(row.quantity * batchCount * 100) / 100;
      const childDoc = await Ingredient.findById(child._id);
      if (childDoc) {
        if (childDoc.stockQuantity < needed) {
          warnings.push(`"${childDoc.name}" chỉ còn ${childDoc.stockQuantity} ${childDoc.unit} (cần ${needed} ${childDoc.unit})`);
        }
        childDoc.stockQuantity = Math.max(0, Math.round((childDoc.stockQuantity - needed) * 100) / 100);
        await childDoc.save();
        deductions.push({ name: childDoc.name, deducted: needed, unit: childDoc.unit, remaining: childDoc.stockQuantity });
      }
    }

    subIng.stockQuantity = Math.round(((subIng.stockQuantity || 0) + addedQty) * 100) / 100;
    await subIng.save();

    res.json({
      message: `Đã nấu ${batchCount} mẻ "${subIng.name}" (+${addedQty.toLocaleString('vi-VN')} ${subIng.unit})${notes ? ' - ' + notes : ''}`,
      ingredient: subIng,
      deductions,
      warnings: warnings.length > 0 ? warnings : null
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi nấu mẻ bán thành phẩm', error: error.message });
  }
});

// Xóa nguyên liệu
router.delete('/:id', async (req, res) => {
  try {
    const usedInProducts = await Product.find({
      $or: [
        { 'recipe.ingredient': req.params.id },
        { 'perCupExtras.ingredient': req.params.id }
      ]
    });
    if (usedInProducts.length > 0) {
      return res.status(400).json({
        message: `Không thể xóa vì đang dùng trong món: ${usedInProducts.map(p => p.name).join(', ')}`
      });
    }

    const usedInToppings = await Topping.find({ ingredient: req.params.id });
    if (usedInToppings.length > 0) {
      return res.status(400).json({
        message: `Không thể xóa vì đang liên kết với topping: ${usedInToppings.map(t => t.name).join(', ')}`
      });
    }

    const usedInSub = await Ingredient.find({ isSubRecipe: true, 'subRecipe.ingredient': req.params.id });
    if (usedInSub.length > 0) {
      return res.status(400).json({
        message: `Không thể xóa vì đang dùng trong bán thành phẩm: ${usedInSub.map(s => s.name).join(', ')}`
      });
    }

    await Ingredient.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa nguyên liệu thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa nguyên liệu', error: error.message });
  }
});

module.exports = router;
