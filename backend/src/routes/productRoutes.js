const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Ingredient = require('../models/Ingredient');
const { computeProductCostAndStats, syncAllSubRecipes } = require('../utils/costing');

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

// Nạp nhanh công thức mẫu chuẩn Trà Lộc Phát: Trà Sữa Ôlong Bắp Non (không xóa dữ liệu hiện có)
router.post('/seed-demo-recipe', async (req, res) => {
  try {
    const upsertIng = async (data) => {
      let doc = await Ingredient.findOne({ name: data.name });
      if (!doc) {
        doc = await Ingredient.create(data);
      }
      return doc;
    };

    // 1. Nguyên liệu thô đúng như bảng Trà Lộc Phát
    const traOlong = await upsertIng({
      name: 'Trà Ôlong Lộc Phát',
      unit: 'g',
      category: 'Trà & Thảo mộc',
      purchaseUnit: 'Gói',
      conversionRate: 1000,
      purchasePrice: 305000,
      costPerUnit: 305,
      stockQuantity: 2000,
      minStockAlert: 300,
      kcalPerUnit: 0,
      trackInventory: true,
      notes: '305.000đ/1kg'
    });

    const suaYenMach = await upsertIng({
      name: 'Sữa yến mạch Oatside',
      unit: 'ml',
      category: 'Sữa & Béo',
      purchaseUnit: 'Hộp',
      conversionRate: 1000,
      purchasePrice: 42000,
      costPerUnit: 42,
      stockQuantity: 6000,
      minStockAlert: 1000,
      kcalPerUnit: 0.46,
      trackInventory: true,
      notes: '42.000đ/1 lít'
    });

    const nuocLoc = await upsertIng({
      name: 'Nước lọc pha chế',
      unit: 'ml',
      category: 'Nguyên liệu khác',
      purchaseUnit: 'Lít',
      conversionRate: 1000,
      purchasePrice: 0,
      costPerUnit: 0,
      stockQuantity: 0,
      minStockAlert: 0,
      kcalPerUnit: 0,
      trackInventory: false,
      notes: 'Không tính giá vốn & không trừ kho'
    });

    const suaDac = await upsertIng({
      name: 'Sữa đặc (1kg)',
      unit: 'g',
      category: 'Sữa & Béo',
      purchaseUnit: 'Hộp',
      conversionRate: 1000,
      purchasePrice: 41000,
      costPerUnit: 41,
      stockQuantity: 3000,
      minStockAlert: 500,
      kcalPerUnit: 3.13,
      trackInventory: true,
      notes: '41.000đ/1kg'
    });

    const muoiHam = await upsertIng({
      name: 'Muối hầm Lộc Phát',
      unit: 'ml',
      category: 'Nguyên liệu khác',
      purchaseUnit: 'Gói',
      conversionRate: 500,
      purchasePrice: 21000,
      costPerUnit: 42,
      stockQuantity: 500,
      minStockAlert: 50,
      kcalPerUnit: 0,
      trackInventory: true,
      notes: '21.000đ/500g'
    });

    const daBi = await upsertIng({
      name: 'Đá bi làm nguội',
      unit: 'g',
      category: 'Nguyên liệu khác',
      purchaseUnit: 'Kg',
      conversionRate: 1000,
      purchasePrice: 0,
      costPerUnit: 0,
      stockQuantity: 0,
      minStockAlert: 0,
      kcalPerUnit: 0,
      trackInventory: false,
      notes: 'Dùng để sốc nhiệt cốt trà, không trừ kho'
    });

    const bapTrai = await upsertIng({
      name: 'Bắp trái tươi',
      unit: 'g',
      category: 'Topping',
      purchaseUnit: 'Trái',
      conversionRate: 200,
      purchasePrice: 5000,
      costPerUnit: 25,
      stockQuantity: 2000,
      minStockAlert: 400,
      kcalPerUnit: 1.03,
      trackInventory: true,
      notes: '5.000đ/1 trái (~200g, 1.5 trái = 300g)'
    });

    const nuocLuocBap = await upsertIng({
      name: 'Nước luộc bắp',
      unit: 'ml',
      category: 'Nguyên liệu khác',
      purchaseUnit: 'Lít',
      conversionRate: 1000,
      purchasePrice: 0,
      costPerUnit: 0,
      stockQuantity: 0,
      minStockAlert: 0,
      kcalPerUnit: 0,
      trackInventory: false,
      notes: 'Tận dụng nước luộc bắp, không trừ kho'
    });

    const huongBap = await upsertIng({
      name: 'Hương bắp',
      unit: 'ml',
      category: 'Đường & Syrup',
      purchaseUnit: 'Chai',
      conversionRate: 30,
      purchasePrice: 49000,
      costPerUnit: 1633.3333,
      stockQuantity: 60,
      minStockAlert: 10,
      kcalPerUnit: 0,
      trackInventory: true,
      notes: '49.000đ/30g'
    });

    const bapLuocChin = await upsertIng({
      name: 'Bắp luộc chín (tách hạt)',
      unit: 'g',
      category: 'Topping',
      purchaseUnit: 'Phần',
      conversionRate: 300,
      purchasePrice: 7500,
      costPerUnit: 25,
      stockQuantity: 1500,
      minStockAlert: 300,
      kcalPerUnit: 1.2,
      trackInventory: true,
      notes: '7.500đ/300g'
    });

    const nuocDuong = await upsertIng({
      name: 'Nước đường Hàn Quốc',
      unit: 'ml',
      category: 'Đường & Syrup',
      purchaseUnit: 'Can',
      conversionRate: 25000,
      purchasePrice: 568000,
      costPerUnit: 22.72,
      stockQuantity: 10000,
      minStockAlert: 1000,
      kcalPerUnit: 2.8,
      trackInventory: true,
      notes: '568.000đ/25kg'
    });

    const botNang = await upsertIng({
      name: 'Bột năng',
      unit: 'g',
      category: 'Topping',
      purchaseUnit: 'Bao',
      conversionRate: 10000,
      purchasePrice: 255000,
      costPerUnit: 25.5,
      stockQuantity: 5000,
      minStockAlert: 500,
      kcalPerUnit: 3.75,
      trackInventory: true,
      notes: '255.000đ/10kg'
    });

    // 2. Ba bán thành phẩm (mẻ nấu) đúng như ảnh Trà Lộc Phát
    const cotTraSua = await upsertIng({
      name: 'Nước cốt trà sữa Ôlong',
      unit: 'ml',
      category: 'Bán thành phẩm (Mẻ)',
      isSubRecipe: true,
      yieldQuantity: 3200,
      wastePercent: 0,
      purchaseUnit: 'Mẻ',
      conversionRate: 3200,
      stockQuantity: 3200,
      minStockAlert: 600,
      trackInventory: true,
      instructions: 'Ủ 100g trà Ôlong với nước nóng, lọc bã, đánh tan sữa đặc + muối + sữa yến mạch rồi cho đá bi làm nguội.',
      subRecipe: [
        { ingredient: traOlong._id, quantity: 100 },
        { ingredient: suaYenMach._id, quantity: 2000 },
        { ingredient: nuocLoc._id, quantity: 400 },
        { ingredient: suaDac._id, quantity: 340 },
        { ingredient: muoiHam._id, quantity: 2.5 },
        { ingredient: daBi._id, quantity: 700 }
      ]
    });

    const sotBap = await upsertIng({
      name: 'Sốt bắp non',
      unit: 'ml',
      category: 'Bán thành phẩm (Mẻ)',
      isSubRecipe: true,
      yieldQuantity: 400,
      wastePercent: 0,
      purchaseUnit: 'Mẻ',
      conversionRate: 400,
      stockQuantity: 400,
      minStockAlert: 100,
      trackInventory: true,
      instructions: 'Xay nhuyễn 300g bắp với 200ml nước luộc bắp, rây mịn rồi thêm 7,5ml hương bắp.',
      subRecipe: [
        { ingredient: bapTrai._id, quantity: 300 },
        { ingredient: nuocLuocBap._id, quantity: 200 },
        { ingredient: huongBap._id, quantity: 7.5 }
      ]
    });

    const tranChauBap = await upsertIng({
      name: 'Trân châu bắp (thạch bắp)',
      unit: 'g',
      category: 'Bán thành phẩm (Mẻ)',
      isSubRecipe: true,
      yieldQuantity: 520,
      wastePercent: 0,
      purchaseUnit: 'Mẻ',
      conversionRate: 520,
      stockQuantity: 520,
      minStockAlert: 120,
      trackInventory: true,
      instructions: 'Trộn bắp luộc chín với bột năng, luộc chín vớt ngâm 100ml nước đường.',
      subRecipe: [
        { ingredient: bapLuocChin._id, quantity: 200 },
        { ingredient: nuocDuong._id, quantity: 100 },
        { ingredient: botNang._id, quantity: 300 }
      ]
    });

    // Đồng bộ giá vốn & kcal cho 3 bán thành phẩm
    await syncAllSubRecipes();

    // 3. Món hoàn chỉnh: Trà Sữa Ôlong Bắp Non (3 size 500/700/1000ml + đóng chai 330ml)
    let demoProduct = await Product.findOne({ name: 'Trà Sữa Ôlong Bắp Non' });
    if (!demoProduct) {
      demoProduct = await Product.create({
        name: 'Trà Sữa Ôlong Bắp Non',
        category: 'Trà sữa',
        price: 38000,
        baseSizeLabel: 'Ly 500ml',
        baseVolumeMl: 500,
        packagingCost: 1300,
        packagingNote: 'Ly, muỗng, ống hút',
        wastePercent: 0,
        targetCostPercent: 30,
        image: '🌽',
        description: 'Công thức chuẩn 2 tầng tham khảo từ Trà Lộc Phát (kèm size 500ml/700ml/1000ml & đóng chai 330ml)',
        recipe: [
          { ingredient: cotTraSua._id, quantity: 150 },
          { ingredient: nuocDuong._id, quantity: 15 },
          { ingredient: sotBap._id, quantity: 40 },
          { ingredient: tranChauBap._id, quantity: 60 }
        ],
        variants: [
          { name: 'Ly 700ml', volumeMl: 700, scaleFactor: 1.4, price: 46000, extraPackagingCost: 600 },
          { name: 'Ly 1000ml', volumeMl: 1000, scaleFactor: 2.0, price: 62000, extraPackagingCost: 1900 }
        ],
        bottlingConfig: {
          enabled: true,
          bottleVolumeMl: 330,
          bottleCost: 2200,
          sellPricePerBottle: 28000
        }
      });
    }

    const populated = await Product.findById(demoProduct._id)
      .populate({ path: 'recipe.ingredient', populate: { path: 'subRecipe.ingredient' } });
    const ingMap = await getIngredientMap();

    res.status(201).json({
      message: 'Đã nạp công thức mẫu "Trà Sữa Ôlong Bắp Non" thành công!',
      product: computeProductCostAndStats(populated, ingMap)
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi nạp công thức mẫu', error: error.message });
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
