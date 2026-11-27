const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Ingredient = require('../models/Ingredient');
const Transaction = require('../models/Transaction');

router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(50);
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy đơn hàng', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { items, paymentMethod = 'cash', customerNote = '' } = req.body;
    if (!items || !items.length) return res.status(400).json({ message: 'Đơn hàng trống' });

    const productIds = items.map(i => i.productId);
    const products = await Product.find({ _id: { $in: productIds } }).populate('recipe.ingredient');
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    const ingredientDeductions = new Map();
    let totalAmount = 0;
    let totalCost = 0;
    const orderItems = [];

    for (const item of items) {
      const product = productMap.get(item.productId.toString());
      if (!product) continue;
      const quantity = Number(item.quantity);
      if (quantity <= 0) continue;

      // Xác định size / biến thể (nếu chọn size L / XL / Chai)
      let variantName = product.baseSizeLabel || '';
      let scaleFactor = 1;
      let unitSellPrice = product.price;
      let unitPkgCost = Number(product.packagingCost) || 0;

      if (item.variantName && item.variantName !== product.baseSizeLabel) {
        if (item.variantName === '__BOTTLE__' && product.bottlingConfig && product.bottlingConfig.enabled) {
          const baseVol = Number(product.baseVolumeMl) || 500;
          const bVol = Number(product.bottlingConfig.bottleVolumeMl) || 330;
          variantName = `Chai ${bVol}ml`;
          scaleFactor = baseVol > 0 ? bVol / baseVol : 1;
          unitSellPrice = Number(product.bottlingConfig.sellPricePerBottle) || product.price;
          unitPkgCost = Number(product.bottlingConfig.bottleCost) || 0;
        } else if (Array.isArray(product.variants)) {
          const matchedVariant = product.variants.find(v => v.name === item.variantName);
          if (matchedVariant) {
            variantName = matchedVariant.name;
            scaleFactor = Number(matchedVariant.scaleFactor) || 1;
            unitSellPrice = Number(matchedVariant.price) || product.price;
            unitPkgCost = (Number(product.packagingCost) || 0) + (Number(matchedVariant.extraPackagingCost) || 0);
          }
        }
      }

      let rawIngCostPerUnit = 0;
      if (product.recipe && product.recipe.length > 0) {
        for (const r of product.recipe) {
          if (!r.ingredient) continue;
          const ingId = r.ingredient._id.toString();
          const qtyForOne = r.quantity * scaleFactor;
          rawIngCostPerUnit += qtyForOne * (r.ingredient.costPerUnit || 0);

          // Chỉ trừ kho những nguyên liệu có bật theo dõi tồn kho
          if (r.ingredient.trackInventory !== false) {
            const needed = Math.round(qtyForOne * quantity * 100) / 100;
            if (!ingredientDeductions.has(ingId)) {
              ingredientDeductions.set(ingId, { ingredient: r.ingredient, quantityNeeded: 0 });
            }
            ingredientDeductions.get(ingId).quantityNeeded = Math.round((ingredientDeductions.get(ingId).quantityNeeded + needed) * 100) / 100;
          }
        }
      }

      const wastePercent = Number(product.wastePercent) || 0;
      const singleCupCost = Math.round(rawIngCostPerUnit * (1 + wastePercent / 100) + unitPkgCost);
      const subtotal = unitSellPrice * quantity;

      totalAmount += subtotal;
      totalCost += (singleCupCost * quantity);

      const displayName = variantName && product.variants && product.variants.length > 0
        ? `${product.name} (${variantName})`
        : (item.variantName === '__BOTTLE__' ? `${product.name} (${variantName})` : product.name);

      orderItems.push({
        product: product._id,
        productName: displayName,
        variantName,
        scaleFactor,
        price: unitSellPrice,
        cost: singleCupCost,
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
