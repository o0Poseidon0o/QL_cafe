const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

function computeProductCostAndStats(product) {
  let costPrice = 0;
  let maxCupsPossible = Infinity;
  const recipeDetails = [];

  if (product.recipe && product.recipe.length > 0) {
    for (const item of product.recipe) {
      const ing = item.ingredient;
      if (ing && typeof ing === 'object') {
        const itemCost = Math.round(item.quantity * (ing.costPerUnit || 0));
        costPrice += itemCost;

        const cupsFromThisIng = ing.stockQuantity > 0 ? Math.floor(ing.stockQuantity / item.quantity) : 0;
        if (cupsFromThisIng < maxCupsPossible) maxCupsPossible = cupsFromThisIng;

        recipeDetails.push({
          ingredientId: ing._id,
          name: ing.name,
          unit: ing.unit,
          costPerUnit: ing.costPerUnit || 0,
          quantity: item.quantity,
          itemCost,
          currentStock: ing.stockQuantity,
          availableCups: cupsFromThisIng
        });
      }
    }
  }

  if (maxCupsPossible === Infinity) maxCupsPossible = 0;
  const grossProfit = product.price - costPrice;
  const profitMargin = product.price > 0 ? Math.round((grossProfit / product.price) * 100) : 0;

  return {
    ...product.toObject(),
    costPrice,
    grossProfit,
    profitMargin,
    maxCupsPossible,
    recipeDetails
  };
}

router.get('/', async (req, res) => {
  try {
    const products = await Product.find().populate('recipe.ingredient').sort({ category: 1, name: 1 });
    res.json(products.map(computeProductCostAndStats));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách món', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('recipe.ingredient');
    if (!product) return res.status(404).json({ message: 'Không tìm thấy món' });
    res.json(computeProductCostAndStats(product));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy chi tiết món', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, category, price, recipe, image, description } = req.body;
    const existing = await Product.findOne({ name: name.trim() });
    if (existing) return res.status(400).json({ message: 'Tên món này đã có trong menu!' });

    const formattedRecipe = (recipe || []).map(item => ({
      ingredient: item.ingredient,
      quantity: Number(item.quantity)
    }));

    const product = new Product({
      name: name.trim(),
      category: category ? category.trim() : 'Cà phê',
      price: Number(price),
      recipe: formattedRecipe,
      image: image || '🥤',
      description: description || ''
    });

    await product.save();
    const populated = await Product.findById(product._id).populate('recipe.ingredient');
    res.status(201).json(computeProductCostAndStats(populated));
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi tạo món', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, category, price, recipe, image, description } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy món' });

    if (name !== undefined) product.name = name.trim();
    if (category !== undefined) product.category = category.trim();
    if (price !== undefined) product.price = Number(price);
    if (image !== undefined) product.image = image;
    if (description !== undefined) product.description = description;
    if (recipe !== undefined) {
      product.recipe = recipe.map(item => ({
        ingredient: item.ingredient,
        quantity: Number(item.quantity)
      }));
    }

    await product.save();
    const populated = await Product.findById(product._id).populate('recipe.ingredient');
    res.json(computeProductCostAndStats(populated));
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi cập nhật món', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa món thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa món', error: error.message });
  }
});

module.exports = router;
