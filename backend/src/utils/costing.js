const Ingredient = require('../models/Ingredient');

function round2(num) {
  return Math.round((Number(num) || 0) * 100) / 100;
}

function round4(num) {
  return Math.round((Number(num) || 0) * 10000) / 10000;
}

function formatViNumber(num) {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return Number(num).toLocaleString('vi-VN');
}

/**
 * Tạo chuỗi giá quy cách dễ hiểu kiểu Trà Lộc Phát:
 * VD: "305.000đ/1kg", "42.000đ/1 lít", "128.545đ/3.200ml", "49.000đ/30g", "-"
 */
function formatSpecPrice(ing) {
  if (!ing) return '-';
  const costPerUnit = Number(ing.costPerUnit) || 0;
  if (costPerUnit <= 0 && !(ing.purchasePrice > 0)) return '-';

  // Nếu là bán thành phẩm (mẻ nấu)
  if (ing.isSubRecipe && ing.yieldQuantity > 0) {
    const batchTotal = ing.purchasePrice > 0
      ? Math.round(ing.purchasePrice)
      : Math.round(costPerUnit * ing.yieldQuantity);
    return `${formatViNumber(batchTotal)}đ/${formatViNumber(ing.yieldQuantity)}${ing.unit}`;
  }

  // Nếu có quy cách đóng gói (VD: 1kg = 1000g, 1 lít = 1000ml, 30g...)
  const rate = Number(ing.conversionRate) || 1;
  const pPrice = ing.purchasePrice > 0
    ? Math.round(ing.purchasePrice)
    : Math.round(costPerUnit * rate);

  if (rate > 1) {
    const unitLower = (ing.unit || '').toLowerCase();
    if (unitLower === 'g' && rate % 1000 === 0) {
      return `${formatViNumber(pPrice)}đ/${formatViNumber(rate / 1000)}kg`;
    }
    if (unitLower === 'ml' && rate % 1000 === 0) {
      return `${formatViNumber(pPrice)}đ/${formatViNumber(rate / 1000)} lít`;
    }
    const needsSpace = !['g', 'kg', 'ml', 'l'].includes(unitLower);
    return `${formatViNumber(pPrice)}đ/${formatViNumber(rate)}${needsSpace ? ' ' : ''}${ing.unit}`;
  }

  const labelUnit = ing.purchaseUnit ? `1 ${ing.purchaseUnit}` : `1 ${ing.unit}`;
  return `${formatViNumber(Math.round(pPrice))}đ/${labelUnit}`;
}

/**
 * Tính toán chi tiết 1 mẻ bán thành phẩm (từ danh sách subRecipe đã populate hoặc map)
 */
function computeSubRecipeMetrics(subIng, ingredientMap) {
  const items = [];
  let rawBatchCost = 0;
  let totalBatchKcal = 0;

  const list = subIng.subRecipe || [];
  for (const row of list) {
    let child = row.ingredient;
    if (child && typeof child !== 'object' && ingredientMap) {
      child = ingredientMap.get(child.toString());
    }
    if (!child || typeof child !== 'object') continue;

    const qty = Number(row.quantity) || 0;
    const unitCost = Number(child.costPerUnit) || 0;
    const itemCost = Math.round(qty * unitCost);
    const itemKcal = round2(qty * (Number(child.kcalPerUnit) || 0));

    rawBatchCost += qty * unitCost;
    totalBatchKcal += itemKcal;

    items.push({
      ingredientId: child._id,
      name: child.name,
      unit: child.unit,
      specPrice: formatSpecPrice(child),
      costPerUnit: unitCost,
      quantity: qty,
      itemCost,
      kcal: Math.round(itemKcal),
      trackInventory: child.trackInventory !== false
    });
  }

  const wastePercent = Number(subIng.wastePercent) || 0;
  const batchCostWithWaste = rawBatchCost * (1 + wastePercent / 100);
  const yieldQty = Number(subIng.yieldQuantity) || 0;
  const costPerUnit = yieldQty > 0 ? round4(batchCostWithWaste / yieldQty) : 0;
  const kcalPerUnit = yieldQty > 0 ? round4(totalBatchKcal / yieldQty) : 0;

  return {
    items,
    rawBatchCost: Math.round(rawBatchCost),
    wastePercent,
    batchCost: Math.round(batchCostWithWaste),
    totalBatchKcal: Math.round(totalBatchKcal),
    yieldQuantity: yieldQty,
    costPerUnit,
    kcalPerUnit
  };
}

/**
 * Đồng bộ lại giá vốn và kcal cho tất cả bán thành phẩm trong DB
 * (Chạy 2 lượt để hỗ trợ bán thành phẩm lồng nhau 2 cấp an toàn)
 */
async function syncAllSubRecipes() {
  const allIngredients = await Ingredient.find();
  const ingMap = new Map(allIngredients.map(i => [i._id.toString(), i]));
  const subRecipes = allIngredients.filter(i => i.isSubRecipe && i.yieldQuantity > 0);
  if (!subRecipes.length) return [];

  const updatedNames = [];
  for (let pass = 0; pass < 2; pass++) {
    for (const sub of subRecipes) {
      const metrics = computeSubRecipeMetrics(sub, ingMap);
      const changed =
        Math.abs((sub.costPerUnit || 0) - metrics.costPerUnit) > 0.0001 ||
        Math.abs((sub.purchasePrice || 0) - metrics.batchCost) > 0.5 ||
        Math.abs((sub.kcalPerUnit || 0) - metrics.kcalPerUnit) > 0.0001 ||
        sub.conversionRate !== sub.yieldQuantity;

      if (changed) {
        sub.costPerUnit = metrics.costPerUnit;
        sub.purchasePrice = metrics.batchCost;
        sub.conversionRate = sub.yieldQuantity;
        sub.purchaseUnit = sub.purchaseUnit || 'Mẻ';
        sub.kcalPerUnit = metrics.kcalPerUnit;
        await sub.save();
        if (!updatedNames.includes(sub.name)) updatedNames.push(sub.name);
      }
    }
  }

  return updatedNames;
}

function suggestRetailPrice(costPrice, targetCostPercent = 30) {
  if (!costPrice || costPrice <= 0) return 0;
  const pct = Math.max(5, Math.min(95, Number(targetCostPercent) || 30));
  const raw = costPrice / (pct / 100);
  return Math.ceil(raw / 1000) * 1000;
}

/**
 * Tính toàn bộ bảng giá thành phân tầng (giống Trà Lộc Phát) cho 1 món
 */
function computeProductCostAndStats(product, ingredientMap = null) {
  let rawIngredientsCost = 0;
  let totalKcal = 0;
  let maxCupsPossible = Infinity;
  let hasTrackedIngredient = false;

  const recipeDetails = [];
  const subRecipeBreakdowns = [];
  const seenSubIds = new Set();

  if (product.recipe && product.recipe.length > 0) {
    for (const item of product.recipe) {
      const ing = item.ingredient;
      if (!ing || typeof ing !== 'object') continue;

      const qty = Number(item.quantity) || 0;
      const unitCost = Number(ing.costPerUnit) || 0;
      const exactCost = qty * unitCost;
      const itemCost = Math.round(exactCost);
      const itemKcal = Math.round(qty * (Number(ing.kcalPerUnit) || 0));

      rawIngredientsCost += exactCost;
      totalKcal += itemKcal;

      const trackInv = ing.trackInventory !== false;
      let cupsFromThisIng = null;
      if (trackInv) {
        hasTrackedIngredient = true;
        cupsFromThisIng = ing.stockQuantity > 0 ? Math.floor(ing.stockQuantity / qty) : 0;
        if (cupsFromThisIng < maxCupsPossible) maxCupsPossible = cupsFromThisIng;
      }

      recipeDetails.push({
        ingredientId: ing._id,
        name: ing.name,
        unit: ing.unit,
        isSubRecipe: !!ing.isSubRecipe,
        trackInventory: trackInv,
        specPrice: formatSpecPrice(ing),
        costPerUnit: unitCost,
        quantity: qty,
        itemCost,
        kcal: itemKcal,
        currentStock: ing.stockQuantity,
        availableCups: cupsFromThisIng
      });

      // Nếu là bán thành phẩm -> bóc tách chi tiết mẻ nấu (tầng 1 giống Trà Lộc Phát)
      if (ing.isSubRecipe && ing.yieldQuantity > 0 && !seenSubIds.has(ing._id.toString())) {
        seenSubIds.add(ing._id.toString());
        const metrics = computeSubRecipeMetrics(ing, ingredientMap);
        subRecipeBreakdowns.push({
          ingredientId: ing._id,
          name: ing.name,
          unit: ing.unit,
          yieldQuantity: ing.yieldQuantity,
          wastePercent: metrics.wastePercent,
          batchCost: metrics.batchCost,
          rawBatchCost: metrics.rawBatchCost,
          costPerUnit: metrics.costPerUnit,
          usedQuantityInDrink: qty,
          usedCostInDrink: itemCost,
          usedKcalInDrink: itemKcal,
          portionsPerBatch: qty > 0 ? Math.floor(ing.yieldQuantity / qty) : 0,
          instructions: ing.instructions || '',
          items: metrics.items
        });
      }
    }
  }

  if (!hasTrackedIngredient) {
    maxCupsPossible = 999;
  } else if (maxCupsPossible === Infinity) {
    maxCupsPossible = 0;
  }

  const packagingCost = Number(product.packagingCost) || 0;
  const wastePercent = Number(product.wastePercent) || 0;
  const wasteCost = Math.round(rawIngredientsCost * (wastePercent / 100));
  const costPrice = Math.round(rawIngredientsCost + wasteCost + packagingCost);

  const grossProfit = product.price - costPrice;
  const profitMargin = product.price > 0 ? Math.round((grossProfit / product.price) * 100) : 0;
  const foodCostPercent = product.price > 0 ? Math.round((costPrice / product.price) * 100) : 0;
  const targetCostPercent = Number(product.targetCostPercent) || 30;
  const suggestedPrice = suggestRetailPrice(costPrice, targetCostPercent);

  // Tính bảng so sánh nhiều Size (500ml / 700ml / 1000ml...)
  const baseSizeLabel = product.baseSizeLabel || 'Ly 500ml';
  const baseVolumeMl = Number(product.baseVolumeMl) || 500;

  const variantBreakdowns = [
    {
      name: baseSizeLabel,
      volumeMl: baseVolumeMl,
      scaleFactor: 1,
      isBase: true,
      price: product.price,
      packagingCost,
      costPrice,
      kcal: totalKcal,
      grossProfit,
      profitMargin,
      foodCostPercent,
      suggestedPrice
    }
  ];

  if (Array.isArray(product.variants) && product.variants.length > 0) {
    for (const v of product.variants) {
      const factor = Number(v.scaleFactor) || 1;
      const vExtraPkg = Number(v.extraPackagingCost) || 0;
      const vPkg = packagingCost + vExtraPkg;
      const vIngCost = rawIngredientsCost * factor * (1 + wastePercent / 100);
      const vCost = Math.round(vIngCost + vPkg);
      const vKcal = Math.round(totalKcal * factor);
      const vPrice = Number(v.price) || 0;
      const vProfit = vPrice - vCost;
      const vMargin = vPrice > 0 ? Math.round((vProfit / vPrice) * 100) : 0;
      const vFoodCost = vPrice > 0 ? Math.round((vCost / vPrice) * 100) : 0;

      variantBreakdowns.push({
        name: v.name,
        volumeMl: Number(v.volumeMl) || Math.round(baseVolumeMl * factor),
        scaleFactor: factor,
        isBase: false,
        price: vPrice,
        packagingCost: vPkg,
        extraPackagingCost: vExtraPkg,
        costPrice: vCost,
        kcal: vKcal,
        grossProfit: vProfit,
        profitMargin: vMargin,
        foodCostPercent: vFoodCost,
        suggestedPrice: suggestRetailPrice(vCost, targetCostPercent)
      });
    }
  }

  // Tính chế độ Trà sữa đóng chai (nếu bật)
  let bottlingSummary = null;
  if (product.bottlingConfig && product.bottlingConfig.enabled) {
    const bottleVol = Number(product.bottlingConfig.bottleVolumeMl) || 330;
    const bottlePkg = Number(product.bottlingConfig.bottleCost) || 0;
    const sellPrice = Number(product.bottlingConfig.sellPricePerBottle) || 0;

    // Quy đổi phần nguyên liệu lỏng/cốt theo tỷ lệ dung tích chai so với ly chuẩn
    const liquidRatio = baseVolumeMl > 0 ? bottleVol / baseVolumeMl : 1;
    const liquidCostPerBottle = Math.round(rawIngredientsCost * liquidRatio * (1 + wastePercent / 100));
    const costPerBottle = liquidCostPerBottle + bottlePkg;
    const profitPerBottle = sellPrice - costPerBottle;
    const marginPerBottle = sellPrice > 0 ? Math.round((profitPerBottle / sellPrice) * 100) : 0;

    // Nếu món có dùng bán thành phẩm dạng ml (nước cốt chính), ước tính số chai đóng được từ 1 mẻ cốt
    const mainLiquidSub = subRecipeBreakdowns.find(s => (s.unit || '').toLowerCase() === 'ml' && s.usedQuantityInDrink > 0);
    let bottlesPerBatch = null;
    let leftoverMl = null;
    let mainSubName = null;
    if (mainLiquidSub) {
      const mlPerBottle = mainLiquidSub.usedQuantityInDrink * liquidRatio;
      if (mlPerBottle > 0) {
        bottlesPerBatch = Math.floor(mainLiquidSub.yieldQuantity / mlPerBottle);
        leftoverMl = Math.round(mainLiquidSub.yieldQuantity - bottlesPerBatch * mlPerBottle);
        mainSubName = mainLiquidSub.name;
      }
    }

    bottlingSummary = {
      bottleVolumeMl: bottleVol,
      bottleCost: bottlePkg,
      liquidCostPerBottle,
      costPerBottle,
      sellPricePerBottle: sellPrice,
      profitPerBottle,
      marginPerBottle,
      suggestedPrice: suggestRetailPrice(costPerBottle, targetCostPercent),
      bottlesPerBatch,
      leftoverMl,
      mainSubName,
      profitPerBatch: bottlesPerBatch ? bottlesPerBatch * profitPerBottle : null
    };
  }

  return {
    ...product.toObject(),
    rawIngredientsCost: Math.round(rawIngredientsCost),
    wasteCost,
    packagingCost,
    costPrice,
    totalKcal,
    grossProfit,
    profitMargin,
    foodCostPercent,
    targetCostPercent,
    suggestedPrice,
    maxCupsPossible,
    hasTrackedIngredient,
    recipeDetails,
    subRecipeBreakdowns,
    variantBreakdowns,
    bottlingSummary
  };
}

module.exports = {
  round2,
  round4,
  formatSpecPrice,
  computeSubRecipeMetrics,
  syncAllSubRecipes,
  suggestRetailPrice,
  computeProductCostAndStats
};
