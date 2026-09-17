const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');

router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    const query = {};
    if (type && type !== 'all') query.type = type;

    const transactions = await Transaction.find(query).sort({ date: -1, createdAt: -1 }).limit(100);
    const all = await Transaction.find(query);
    let totalIncome = 0;
    let totalExpense = 0;
    for (const t of all) {
      if (t.type === 'income') totalIncome += t.amount;
      if (t.type === 'expense') totalExpense += t.amount;
    }

    res.json({
      transactions,
      summary: {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thu chi', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { type, category, amount, description, date } = req.body;
    const transaction = new Transaction({
      type,
      category,
      amount: Number(amount),
      description: description || '',
      date: date ? new Date(date) : new Date()
    });
    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ message: 'Lỗi tạo phiếu thu chi', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa phiếu' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa phiếu', error: error.message });
  }
});

module.exports = router;
