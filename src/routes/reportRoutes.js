const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Ingredient = require('../models/Ingredient');
const Transaction = require('../models/Transaction');

router.get('/dashboard', async (req, res) => {
  try {
    const { period = '30days' } = req.query;
    const now = new Date();
    let startDate = new Date();

    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === '7days') {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === '30days') {
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date(0);
    }

    const completedOrders = await Order.find({
      status: 'completed',
      createdAt: { $gte: startDate }
    });

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalCupsSold = 0;
    const productSalesMap = new Map();

    for (const ord of completedOrders) {
      totalRevenue += ord.totalAmount;
      totalCogs += ord.totalCost;

      for (const item of ord.items) {
        totalCupsSold += item.quantity;
        const key = item.productName;
        const itemGrossProfit = (item.price - (item.cost || 0)) * item.quantity;

        if (!productSalesMap.has(key)) {
          productSalesMap.set(key, { name: key, quantity: 0, revenue: 0, profit: 0 });
        }
        const pStat = productSalesMap.get(key);
        pStat.quantity += item.quantity;
        pStat.revenue += item.subtotal;
        pStat.profit += itemGrossProfit;
      }
    }

    const grossProfit = totalRevenue - totalCogs;

    const operatingTransactions = await Transaction.find({
      type: 'expense',
      category: { $ne: 'Nhập nguyên liệu' },
      date: { $gte: startDate }
    });

    let totalOperatingExpenses = 0;
    for (const tr of operatingTransactions) {
      totalOperatingExpenses += tr.amount;
    }

    const netProfit = grossProfit - totalOperatingExpenses;
    const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

    const ingredients = await Ingredient.find();
    let totalInventoryValue = 0;
    let lowStockCount = 0;
    const lowStockItems = [];

    for (const ing of ingredients) {
      totalInventoryValue += Math.round(ing.stockQuantity * ing.costPerUnit);
      if (ing.stockQuantity <= ing.minStockAlert) {
        lowStockCount++;
        lowStockItems.push({
          name: ing.name,
          stock: ing.stockQuantity,
          unit: ing.unit,
          alert: ing.minStockAlert
        });
      }
    }

    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const chartLabels = [];
    const chartRevenue = [];
    const chartCogs = [];
    const chartProfit = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

      chartLabels.push(`${d.getDate()}/${d.getMonth() + 1}`);
      const dayOrders = completedOrders.filter(o => o.createdAt >= dayStart && o.createdAt <= dayEnd);
      const dayRev = dayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const dayCost = dayOrders.reduce((sum, o) => sum + o.totalCost, 0);
      chartRevenue.push(dayRev);
      chartCogs.push(dayCost);
      chartProfit.push(dayRev - dayCost);
    }

    res.json({
      summary: {
        totalRevenue,
        totalCogs,
        grossProfit,
        totalOperatingExpenses,
        netProfit,
        profitMargin,
        orderCount: completedOrders.length,
        totalCupsSold,
        totalInventoryValue,
        lowStockCount
      },
      topProducts,
      lowStockItems,
      chartData: {
        labels: chartLabels,
        revenue: chartRevenue,
        cogs: chartCogs,
        profit: chartProfit
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải báo cáo', error: error.message });
  }
});

module.exports = router;
