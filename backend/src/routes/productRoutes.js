const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Ingredient = require('../models/Ingredient');
const { computeProductCostAndStats } = require('../utils/costing');

async function getIngredientMap() {
  const all = await Ingredient.find();
  return new Map(all.map(i => [i._id.toString(), i]));
}

function populateProductQuery(query) {
  return query
    .populate({
      path: 'recipe.ingredient',
      populate: { path: 'subRecipe.ingredient' }
    })
    .populate({
      path: 'perCupExtras.ingredient',
      populate: { path: 'subRecipe.ingredient' }
    });
}

function sanitizeRecipeArray(arr) {
  return (Array.isArray(arr) ? arr : [])
    .filter(item => item.ingredient && Number(item.quantity) > 0)
    .map(item => ({
      ingredient: item.ingredient,
      quantity: Number(item.quantity)
    }));
}

function sanitizeVariantsArray(arr) {
  return (Array.isArray(arr) ? arr : [])
    .filter(v => v.name && v.name.trim())
    .map(v => ({
      name: v.name.trim(),
      volumeMl: Number(v.volumeMl) || 0,
      scaleFactor: Number(v.scaleFactor) > 0 ? Number(v.scaleFactor) : 1,
      portionVolume: Number(v.portionVolume) || 0,
      portionCount: Number(v.portionCount) || 0,
      price: Number(v.price) || 0,
      packagingCost: v.packagingCost !== null && v.packagingCost !== undefined && v.packagingCost !== '' ? Number(v.packagingCost) : null,
      extraPackagingCost: Number(v.extraPackagingCost) || 0
    }));
}

router.get('/', async (req, res) => {
  try {
    const [products, ingMap] = await Promise.all([
      populateProductQuery(Product.find()).sort({ category: 1, name: 1 }),
      getIngredientMap()
    ]);

    res.json(products.map(p => computeProductCostAndStats(p, ingMap)));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách món', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [product, ingMap] = await Promise.all([
      populateProductQuery(Product.findById(req.params.id)),
      getIngredientMap()
    ]);

    if (!product) return res.status(404).json({ message: 'Không tìm thấy món' });
    res.json(computeProductCostAndStats(product, ingMap));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy chi tiết món', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      name, category, price, recipe, image, description,
      recipeMode, batchYieldVolume, batchYieldUnit, batchSplitMode,
      batchPortionVolume, batchPortionCount, perCupExtras,
      baseSizeLabel, baseVolumeMl, packagingCost, packagingNote,
      wastePercent, targetCostPercent, variants, bottlingConfig
    } = req.body;

    const existing = await Product.findOne({ name: name.trim() });
    if (existing) return res.status(400).json({ message: 'Tên món này đã có trong menu!' });

    const product = new Product({
      name: name.trim(),
      category: category ? category.trim() : 'Cà phê',
      recipeMode: recipeMode === 'batch' ? 'batch' : 'per_cup',
      batchYieldVolume: Number(batchYieldVolume) || 2000,
      batchYieldUnit: batchYieldUnit ? batchYieldUnit.trim() : 'ml',
      batchSplitMode: batchSplitMode === 'by_count' ? 'by_count' : 'by_volume',
      batchPortionVolume: Number(batchPortionVolume) || 150,
      batchPortionCount: Number(batchPortionCount) || 15,
      perCupExtras: sanitizeRecipeArray(perCupExtras),
      price: Number(price),
      baseSizeLabel: baseSizeLabel ? baseSizeLabel.trim() : 'Ly 500ml',
      baseVolumeMl: Number(baseVolumeMl) > 0 ? Number(baseVolumeMl) : 500,
      packagingCost: Number(packagingCost) || 0,
      packagingNote: packagingNote ? packagingNote.trim() : 'Ly, muỗng, ống hút',
      wastePercent: Number(wastePercent) || 0,
      targetCostPercent: Number(targetCostPercent) || 30,
      recipe: sanitizeRecipeArray(recipe),
      variants: sanitizeVariantsArray(variants),
      bottlingConfig: bottlingConfig ? {
        enabled: !!bottlingConfig.enabled,
        bottleVolumeMl: Number(bottlingConfig.bottleVolumeMl) || 330,
        bottleCost: Number(bottlingConfig.bottleCost) || 0,
        sellPricePerBottle: Number(bottlingConfig.sellPricePerBottle) || 0
      } : undefined,
      image: image || '🥤',
      description: description || ''
    });

    await product.save();
    const [populated, ingMap] = await Promise.all([
      populateProductQuery(Product.findById(product._id)),
      getIngredientMap()
    ]);

    res.status(201).json(computeProductCostAndStats(populated, ingMap));
  } catch (error) {
    res.status(400).json({ message: 'Lỗi khi tạo món', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      name, category, price, recipe, image, description,
      recipeMode, batchYieldVolume, batchYieldUnit, batchSplitMode,
      batchPortionVolume, batchPortionCount, perCupExtras,
      baseSizeLabel, baseVolumeMl, packagingCost, packagingNote,
      wastePercent, targetCostPercent, variants, bottlingConfig
    } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy món' });

    if (name !== undefined) product.name = name.trim();
    if (category !== undefined) product.category = category.trim();
    if (recipeMode !== undefined) product.recipeMode = recipeMode === 'batch' ? 'batch' : 'per_cup';
    if (batchYieldVolume !== undefined) product.batchYieldVolume = Number(batchYieldVolume) || 2000;
    if (batchYieldUnit !== undefined) product.batchYieldUnit = batchYieldUnit.trim() || 'ml';
    if (batchSplitMode !== undefined) product.batchSplitMode = batchSplitMode === 'by_count' ? 'by_count' : 'by_volume';
    if (batchPortionVolume !== undefined) product.batchPortionVolume = Number(batchPortionVolume) || 150;
    if (batchPortionCount !== undefined) product.batchPortionCount = Number(batchPortionCount) || 15;
    if (perCupExtras !== undefined) product.perCupExtras = sanitizeRecipeArray(perCupExtras);
    if (price !== undefined) product.price = Number(price);
    if (image !== undefined) product.image = image;
    if (description !== undefined) product.description = description;
    if (baseSizeLabel !== undefined) product.baseSizeLabel = baseSizeLabel.trim() || 'Ly 500ml';
    if (baseVolumeMl !== undefined) product.baseVolumeMl = Number(baseVolumeMl) > 0 ? Number(baseVolumeMl) : 500;
    if (packagingCost !== undefined) product.packagingCost = Number(packagingCost) || 0;
    if (packagingNote !== undefined) product.packagingNote = packagingNote.trim();
    if (wastePercent !== undefined) product.wastePercent = Number(wastePercent) || 0;
    if (targetCostPercent !== undefined) product.targetCostPercent = Number(targetCostPercent) || 30;
    if (recipe !== undefined) product.recipe = sanitizeRecipeArray(recipe);
    if (variants !== undefined) product.variants = sanitizeVariantsArray(variants);
    if (bottlingConfig !== undefined) {
      product.bottlingConfig = {
        enabled: !!bottlingConfig.enabled,
        bottleVolumeMl: Number(bottlingConfig.bottleVolumeMl) || 330,
        bottleCost: Number(bottlingConfig.bottleCost) || 0,
        sellPricePerBottle: Number(bottlingConfig.sellPricePerBottle) || 0
      };
    }

    await product.save();
    const [populated, ingMap] = await Promise.all([
      populateProductQuery(Product.findById(product._id)),
      getIngredientMap()
    ]);

    res.json(computeProductCostAndStats(populated, ingMap));
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
