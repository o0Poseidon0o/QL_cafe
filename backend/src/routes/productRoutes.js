const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Ingredient = require('../models/Ingredient');
const { computeProductCostAndStats } = require('../utils/costing');

async function getIngredientMap() {
  const all = await Ingredient.find();
  return new Map(all.map(i => [i._id.toString(), i]));
}

router.get('/', async (req, res) => {
  try {
    const [products, ingMap] = await Promise.all([
      Product.find()
        .populate({
          path: 'recipe.ingredient',
          populate: { path: 'subRecipe.ingredient' }
        })
        .sort({ category: 1, name: 1 }),
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
      Product.findById(req.params.id).populate({
        path: 'recipe.ingredient',
        populate: { path: 'subRecipe.ingredient' }
      }),
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
      baseSizeLabel, baseVolumeMl, packagingCost, packagingNote,
      wastePercent, targetCostPercent, variants, bottlingConfig
    } = req.body;

    const existing = await Product.findOne({ name: name.trim() });
    if (existing) return res.status(400).json({ message: 'Tên món này đã có trong menu!' });

    const formattedRecipe = (recipe || [])
      .filter(item => item.ingredient && Number(item.quantity) > 0)
      .map(item => ({
        ingredient: item.ingredient,
        quantity: Number(item.quantity)
      }));

    const formattedVariants = Array.isArray(variants)
      ? variants
          .filter(v => v.name && v.name.trim())
          .map(v => ({
            name: v.name.trim(),
            volumeMl: Number(v.volumeMl) || 0,
            scaleFactor: Number(v.scaleFactor) > 0 ? Number(v.scaleFactor) : 1,
            price: Number(v.price) || 0,
            extraPackagingCost: Number(v.extraPackagingCost) || 0
          }))
      : [];

    const product = new Product({
      name: name.trim(),
      category: category ? category.trim() : 'Cà phê',
      price: Number(price),
      baseSizeLabel: baseSizeLabel ? baseSizeLabel.trim() : 'Ly 500ml',
      baseVolumeMl: Number(baseVolumeMl) > 0 ? Number(baseVolumeMl) : 500,
      packagingCost: Number(packagingCost) || 0,
      packagingNote: packagingNote ? packagingNote.trim() : 'Ly, muỗng, ống hút',
      wastePercent: Number(wastePercent) || 0,
      targetCostPercent: Number(targetCostPercent) || 30,
      recipe: formattedRecipe,
      variants: formattedVariants,
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
      Product.findById(product._id).populate({
        path: 'recipe.ingredient',
        populate: { path: 'subRecipe.ingredient' }
      }),
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
      baseSizeLabel, baseVolumeMl, packagingCost, packagingNote,
      wastePercent, targetCostPercent, variants, bottlingConfig
    } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy món' });

    if (name !== undefined) product.name = name.trim();
    if (category !== undefined) product.category = category.trim();
    if (price !== undefined) product.price = Number(price);
    if (image !== undefined) product.image = image;
    if (description !== undefined) product.description = description;
    if (baseSizeLabel !== undefined) product.baseSizeLabel = baseSizeLabel.trim() || 'Ly 500ml';
    if (baseVolumeMl !== undefined) product.baseVolumeMl = Number(baseVolumeMl) > 0 ? Number(baseVolumeMl) : 500;
    if (packagingCost !== undefined) product.packagingCost = Number(packagingCost) || 0;
    if (packagingNote !== undefined) product.packagingNote = packagingNote.trim();
    if (wastePercent !== undefined) product.wastePercent = Number(wastePercent) || 0;
    if (targetCostPercent !== undefined) product.targetCostPercent = Number(targetCostPercent) || 30;
    if (recipe !== undefined) {
      product.recipe = recipe
        .filter(item => item.ingredient && Number(item.quantity) > 0)
        .map(item => ({
          ingredient: item.ingredient,
          quantity: Number(item.quantity)
        }));
    }
    if (variants !== undefined && Array.isArray(variants)) {
      product.variants = variants
        .filter(v => v.name && v.name.trim())
        .map(v => ({
          name: v.name.trim(),
          volumeMl: Number(v.volumeMl) || 0,
          scaleFactor: Number(v.scaleFactor) > 0 ? Number(v.scaleFactor) : 1,
          price: Number(v.price) || 0,
          extraPackagingCost: Number(v.extraPackagingCost) || 0
        }));
    }
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
      Product.findById(product._id).populate({
        path: 'recipe.ingredient',
        populate: { path: 'subRecipe.ingredient' }
      }),
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
