const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Ingredient = require('../models/Ingredient');
const Topping = require('../models/Topping');
const Transaction = require('../models/Transaction');

router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(50);
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy đơn hàng', error: error.message });
  }
});

function addDeduction(map, ingredientDoc, qtyNeeded) {
  if (!ingredientDoc || ingredientDoc.trackInventory === false || qtyNeeded <= 0) return;
  const ingId = ingredientDoc._id.toString();
  if (!map.has(ingId)) {
    map.set(ingId, { ingredient: ingredientDoc, quantityNeeded: 0 });
  }
  map.get(ingId).quantityNeeded = Math.round((map.get(ingId).quantityNeeded + qtyNeeded) * 1000) / 1000;
}

router.post('/', async (req, res) => {
  try {
    const { items, paymentMethod = 'cash', customerNote = '' } = req.body;
    if (!items || !items.length) return res.status(400).json({ message: 'Đơn hàng trống' });

    const productIds = items.map(i => i.productId);
    const allToppingIds = [];
    items.forEach(i => {
      if (Array.isArray(i.toppings)) {
        i.toppings.forEach(t => { if (t.toppingId) allToppingIds.push(t.toppingId); });
      }
    });

    const [products, toppings] = await Promise.all([
      Product.find({ _id: { $in: productIds } })
        .populate('recipe.ingredient')
        .populate('perCupExtras.ingredient'),
      allToppingIds.length
        ? Topping.find({ _id: { $in: allToppingIds } }).populate('ingredient')
        : Promise.resolve([])
    ]);

    const productMap = new Map(products.map(p => [p._id.toString(), p]));
    const toppingMap = new Map(toppings.map(t => [t._id.toString(), t]));

    const ingredientDeductions = new Map();
    let totalAmount = 0;
    let totalCost = 0;
    const orderItems = [];

    for (const item of items) {
      const product = productMap.get(item.productId.toString());
      if (!product) continue;
      const quantity = Number(item.quantity);
      if (quantity <= 0) continue;

      const isBatchMode = product.recipeMode === 'batch';
      let variantName = product.baseSizeLabel || '';
      let unitSellPrice = product.price;
      let unitPkgCost = Number(product.packagingCost) || 0;
      let recipeMultiplier = 1; // Hệ số nhân vào `product.recipe` (tỷ lệ mẻ nếu batch, hoặc scaleFactor nếu per_cup)
      let includePerCupExtras = isBatchMode;

      if (isBatchMode) {
        const yieldVol = Math.max(1, Number(product.batchYieldVolume) || 2000);
        const splitMode = product.batchSplitMode === 'by_count' ? 'by_count' : 'by_volume';

        if (item.variantName === '__BOTTLE__' && product.bottlingConfig && product.bottlingConfig.enabled) {
          const bVol = Number(product.bottlingConfig.bottleVolumeMl) || 330;
          variantName = `Chai ${bVol}ml`;
          recipeMultiplier = bVol / yieldVol;
          unitSellPrice = Number(product.bottlingConfig.sellPricePerBottle) || product.price;
          unitPkgCost = Number(product.bottlingConfig.bottleCost) || 0;
          includePerCupExtras = false;
        } else if (item.variantName && item.variantName !== product.baseSizeLabel && Array.isArray(product.variants)) {
          const matchedVariant = product.variants.find(v => v.name === item.variantName);
          if (matchedVariant) {
            variantName = matchedVariant.name;
            unitSellPrice = Number(matchedVariant.price) || product.price;
            unitPkgCost = (Number(product.packagingCost) || 0) + (Number(matchedVariant.extraPackagingCost) || 0);
            if (splitMode === 'by_count') {
              const pCount = Math.max(1, Number(matchedVariant.portionCount) || 1);
              recipeMultiplier = 1 / pCount;
            } else {
              const pVol = Number(matchedVariant.portionVolume) || Number(matchedVariant.volumeMl) || (product.batchPortionVolume || 150);
              recipeMultiplier = pVol / yieldVol;
            }
          } else {
            recipeMultiplier = splitMode === 'by_count'
              ? 1 / Math.max(1, Number(product.batchPortionCount) || 1)
              : (Number(product.batchPortionVolume) || 150) / yieldVol;
          }
        } else {
          recipeMultiplier = splitMode === 'by_count'
            ? 1 / Math.max(1, Number(product.batchPortionCount) || 1)
            : (Number(product.batchPortionVolume) || 150) / yieldVol;
        }
      } else {
        if (item.variantName && item.variantName !== product.baseSizeLabel) {
          if (item.variantName === '__BOTTLE__' && product.bottlingConfig && product.bottlingConfig.enabled) {
            const baseVol = Number(product.baseVolumeMl) || 500;
            const bVol = Number(product.bottlingConfig.bottleVolumeMl) || 330;
            variantName = `Chai ${bVol}ml`;
            recipeMultiplier = baseVol > 0 ? bVol / baseVol : 1;
            unitSellPrice = Number(product.bottlingConfig.sellPricePerBottle) || product.price;
            unitPkgCost = Number(product.bottlingConfig.bottleCost) || 0;
          } else if (Array.isArray(product.variants)) {
            const matchedVariant = product.variants.find(v => v.name === item.variantName);
            if (matchedVariant) {
              variantName = matchedVariant.name;
              recipeMultiplier = Number(matchedVariant.scaleFactor) || 1;
              unitSellPrice = Number(matchedVariant.price) || product.price;
              unitPkgCost = (Number(product.packagingCost) || 0) + (Number(matchedVariant.extraPackagingCost) || 0);
            }
          }
        }
      }

      // 1. Tính giá vốn & trừ kho từ công thức chính (mẻ hoặc 1 ly)
      let rawRecipeCostPerCup = 0;
      for (const r of (product.recipe || [])) {
        if (!r.ingredient) continue;
        const qtyPerCup = r.quantity * recipeMultiplier;
        rawRecipeCostPerCup += qtyPerCup * (r.ingredient.costPerUnit || 0);
        addDeduction(ingredientDeductions, r.ingredient, qtyPerCup * quantity);
      }

      // 2. Tính giá vốn & trừ kho phần cộng thêm cố định mỗi ly (perCupExtras)
      let extrasCostPerCup = 0;
      if (includePerCupExtras && Array.isArray(product.perCupExtras)) {
        for (const e of product.perCupExtras) {
          if (!e.ingredient) continue;
          extrasCostPerCup += e.quantity * (e.ingredient.costPerUnit || 0);
          addDeduction(ingredientDeductions, e.ingredient, e.quantity * quantity);
        }
      }

      // 3. Tính giá bán, giá vốn & trừ kho cho các Topping chọn thêm (multi-select)
      let toppingsPricePerCup = 0;
      let toppingsCostPerCup = 0;
      const savedToppings = [];
      if (Array.isArray(item.toppings)) {
        for (const tReq of item.toppings) {
          const topDoc = toppingMap.get((tReq.toppingId || '').toString());
          const topQty = Math.max(1, Number(tReq.quantity) || 1);
          if (!topDoc) continue;

          const singleTopCost = topDoc.ingredient
            ? Math.round(topDoc.quantity * (topDoc.ingredient.costPerUnit || 0))
            : 0;
          toppingsPricePerCup += (topDoc.price || 0) * topQty;
          toppingsCostPerCup += singleTopCost * topQty;

          savedToppings.push({
            topping: topDoc._id,
            name: topDoc.name,
            price: topDoc.price || 0,
            cost: singleTopCost,
            quantity: topQty
          });

          if (topDoc.ingredient) {
            addDeduction(ingredientDeductions, topDoc.ingredient, topDoc.quantity * topQty * quantity);
          }
        }
      }

      const wastePercent = Number(product.wastePercent) || 0;
      const singleDrinkCost = Math.round(
        rawRecipeCostPerCup * (1 + wastePercent / 100) + extrasCostPerCup + unitPkgCost + toppingsCostPerCup
      );
      const finalUnitPrice = unitSellPrice + toppingsPricePerCup;
      const subtotal = finalUnitPrice * quantity;

      totalAmount += subtotal;
      totalCost += (singleDrinkCost * quantity);

      const toppingSuffix = savedToppings.length > 0
        ? ` + ${savedToppings.map(t => t.quantity > 1 ? `${t.quantity}x ${t.name}` : t.name).join(', ')}`
        : '';

      const baseDisplayName = variantName && ((product.variants && product.variants.length > 0) || item.variantName === '__BOTTLE__')
        ? `${product.name} (${variantName})`
        : product.name;

      orderItems.push({
        product: product._id,
        productName: `${baseDisplayName}${toppingSuffix}`,
        variantName,
        scaleFactor: Math.round(recipeMultiplier * 10000) / 10000,
        toppings: savedToppings,
        price: finalUnitPrice,
        cost: singleDrinkCost,
        quantity,
        subtotal
      });
    }

    const stockWarnings = [];
    for (const [ingId, data] of ingredientDeductions.entries()) {
      const ingDoc = await Ingredient.findById(ingId);
      if (ingDoc && ingDoc.trackInventory !== false) {
        if (ingDoc.stockQuantity < data.quantityNeeded) {
          stockWarnings.push(`Nguyên liệu "${ingDoc.name}" chỉ còn ${ingDoc.stockQuantity} ${ingDoc.unit} (cần ${data.quantityNeeded})`);
        }
        ingDoc.stockQuantity = Math.max(0, Math.round((ingDoc.stockQuantity - data.quantityNeeded) * 100) / 100);
        await ingDoc.save();
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderCode = `ORD-${dateStr}-${randomSuffix}`;

    const order = new Order({
      orderCode,
      items: orderItems,
      totalAmount,
      totalCost,
      paymentMethod,
      customerNote,
      status: 'completed'
    });
    await order.save();

    await Transaction.create({
      type: 'income',
      category: 'Bán hàng',
      amount: totalAmount,
      description: `Thu tiền đơn hàng #${orderCode} (${orderItems.map(i => `${i.quantity}x ${i.productName}`).join(', ')})`,
      relatedOrder: order._id
    });

    res.status(201).json({
      message: 'Tạo đơn hàng thành công và đã trừ kho!',
      order,
      stockWarnings: stockWarnings.length > 0 ? stockWarnings : null
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tạo đơn hàng', error: error.message });
  }
});

module.exports = router;
