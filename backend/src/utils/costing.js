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
 * VD: "305.000đ/1kg", "42.000đ/1 lít", "54.000đ/12 miếng", "128.545đ/3.200ml", "-"
 */
function formatSpecPrice(ing) {
  if (!ing) return '-';
  const costPerUnit = Number(ing.costPerUnit) || 0;
  if (costPerUnit <= 0 && !(ing.purchasePrice > 0)) return '-';

  if (ing.isSubRecipe && ing.yieldQuantity > 0) {
    const batchTotal = ing.purchasePrice > 0
      ? Math.round(ing.purchasePrice)
      : Math.round(costPerUnit * ing.yieldQuantity);
    return `${formatViNumber(batchTotal)}đ/${formatViNumber(ing.yieldQuantity)}${ing.unit}`;
  }

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
 * Tính toán chi tiết 1 mẻ bán thành phẩm
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
 * Tính toán toàn bộ bảng giá thành (hỗ trợ cả 2 chế độ:
 * 1) per_cup: Pha trực tiếp 1 ly
 * 2) batch: Pha theo mẻ lớn (VD: 2.000 ml) rồi chia theo ml/ly HOẶC chia theo số ly/mẻ + phụ liệu riêng từng ly)
 */
function computeProductCostAndStats(product, ingredientMap = null) {
  const isBatchMode = product.recipeMode === 'batch';
  const packagingCost = Number(product.packagingCost) || 0;
  const wastePercent = Number(product.wastePercent) || 0;
  const targetCostPercent = Number(product.targetCostPercent) || 30;
  const baseSizeLabel = product.baseSizeLabel || 'Ly 500ml';
  const baseVolumeMl = Number(product.baseVolumeMl) || 500;

  // 1. Duyệt danh sách recipe chính (1 ly nếu per_cup, hoặc cả 1 mẻ nếu batch)
  let rawRecipeCost = 0;
  let rawRecipeKcal = 0;
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

      rawRecipeCost += exactCost;
      rawRecipeKcal += itemKcal;

      const trackInv = ing.trackInventory !== false;
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
        currentStock: ing.stockQuantity
      });

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

  // 2. Duyệt phần nguyên liệu/topping cố định riêng cho từng ly (perCupExtras - dùng ở chế độ batch)
  let perCupExtrasCost = 0;
  let perCupExtrasKcal = 0;
  const perCupExtraDetails = [];

  if (isBatchMode && Array.isArray(product.perCupExtras) && product.perCupExtras.length > 0) {
    for (const item of product.perCupExtras) {
      const ing = item.ingredient;
      if (!ing || typeof ing !== 'object') continue;

      const qty = Number(item.quantity) || 0;
      const unitCost = Number(ing.costPerUnit) || 0;
      const exactCost = qty * unitCost;
      const itemCost = Math.round(exactCost);
      const itemKcal = Math.round(qty * (Number(ing.kcalPerUnit) || 0));

      perCupExtrasCost += exactCost;
      perCupExtrasKcal += itemKcal;

      perCupExtraDetails.push({
        ingredientId: ing._id,
        name: ing.name,
        unit: ing.unit,
        isSubRecipe: !!ing.isSubRecipe,
        trackInventory: ing.trackInventory !== false,
        specPrice: formatSpecPrice(ing),
        costPerUnit: unitCost,
        quantity: qty,
        itemCost,
        kcal: itemKcal,
        currentStock: ing.stockQuantity
      });
    }
  }

  // ==================== CHẾ ĐỘ B: PHA THEO MẺ LỚN RỒI CHIA LY/CHAI ====================
  if (isBatchMode) {
    const yieldVol = Math.max(0, Number(product.batchYieldVolume) || 0);
    const yieldUnit = product.batchYieldUnit || 'ml';
    const splitMode = product.batchSplitMode === 'by_count' ? 'by_count' : 'by_volume';

    const batchWasteCost = Math.round(rawRecipeCost * (wastePercent / 100));
    const batchTotalCost = Math.round(rawRecipeCost + batchWasteCost);
    const costPerYieldUnit = yieldVol > 0 ? round4(batchTotalCost / yieldVol) : 0;

    const calcBatchPortion = (label, portionVolInput, portionCountInput, sellPrice, extraPkg = 0, isBase = false) => {
      let cupsPerBatch = 0;
      let portionVolume = 0;
      let leftoverVolume = 0;
      let fractionOfBatch = 0;

      if (splitMode === 'by_count') {
        cupsPerBatch = Math.max(1, Number(portionCountInput) || 1);
        fractionOfBatch = 1 / cupsPerBatch;
        portionVolume = yieldVol > 0 ? Math.round(yieldVol / cupsPerBatch) : 0;
        leftoverVolume = 0;
      } else {
        portionVolume = Math.max(1, Number(portionVolInput) || 150);
        if (yieldVol > 0) {
          cupsPerBatch = Math.floor(yieldVol / portionVolume);
          leftoverVolume = Math.round(yieldVol - cupsPerBatch * portionVolume);
          fractionOfBatch = portionVolume / yieldVol;
        }
      }

      const liquidCostPerCup = Math.round(batchTotalCost * fractionOfBatch);
      const totalPkg = packagingCost + extraPkg;
      const costPrice = Math.round(liquidCostPerCup + perCupExtrasCost + totalPkg);
      const kcal = Math.round(rawRecipeKcal * fractionOfBatch + perCupExtrasKcal);
      const price = Number(sellPrice) || 0;
      const grossProfit = price - costPrice;
      const profitMargin = price > 0 ? Math.round((grossProfit / price) * 100) : 0;
      const foodCostPercent = price > 0 ? Math.round((costPrice / price) * 100) : 0;
      const revenuePerBatch = cupsPerBatch * price;
      const profitPerBatch = cupsPerBatch * grossProfit;

      return {
        name: label,
        volumeMl: portionVolume,
        portionVolume,
        portionCount: cupsPerBatch,
        cupsPerBatch,
        leftoverVolume,
        fractionOfBatch: round4(fractionOfBatch),
        scaleFactor: round4(fractionOfBatch),
        isBase,
        price,
        liquidCostPerCup,
        extrasCostPerCup: Math.round(perCupExtrasCost),
        packagingCost: totalPkg,
        extraPackagingCost: extraPkg,
        costPrice,
        kcal,
        grossProfit,
        profitMargin,
        foodCostPercent,
        revenuePerBatch,
        profitPerBatch,
        suggestedPrice: suggestRetailPrice(costPrice, targetCostPercent)
      };
    };

    const baseVariant = calcBatchPortion(
      baseSizeLabel,
      product.batchPortionVolume || 150,
      product.batchPortionCount || 15,
      product.price,
      0,
      true
    );

    const variantBreakdowns = [baseVariant];
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      for (const v of product.variants) {
        const vVol = Number(v.portionVolume) || Number(v.volumeMl) || Math.round((product.batchPortionVolume || 150) * (Number(v.scaleFactor) || 1));
        const vCount = Number(v.portionCount) || Math.max(1, Math.round((product.batchPortionCount || 15) / (Number(v.scaleFactor) || 1)));
        variantBreakdowns.push(
          calcBatchPortion(v.name, vVol, vCount, v.price, Number(v.extraPackagingCost) || 0, false)
        );
      }
    }

    // Tính tồn kho pha được cho size mặc định
    let maxCupsPossible = Infinity;
    let hasTrackedIngredient = false;
    const baseFrac = baseVariant.fractionOfBatch;

    for (const item of recipeDetails) {
      if (!item.trackInventory) continue;
      hasTrackedIngredient = true;
      const perCupQty = item.quantity * baseFrac;
      const cups = perCupQty > 0 && item.currentStock > 0 ? Math.floor(item.currentStock / perCupQty) : 0;
      item.availableCups = cups;
      if (cups < maxCupsPossible) maxCupsPossible = cups;
    }

    for (const item of perCupExtraDetails) {
      if (!item.trackInventory) continue;
      hasTrackedIngredient = true;
      const cups = item.quantity > 0 && item.currentStock > 0 ? Math.floor(item.currentStock / item.quantity) : 0;
      item.availableCups = cups;
      if (cups < maxCupsPossible) maxCupsPossible = cups;
    }

    if (!hasTrackedIngredient) maxCupsPossible = 999;
    else if (maxCupsPossible === Infinity) maxCupsPossible = 0;

    // Tính chế độ Đóng chai nếu bật
    let bottlingSummary = null;
    if (product.bottlingConfig && product.bottlingConfig.enabled && yieldVol > 0) {
      const bottleVol = Number(product.bottlingConfig.bottleVolumeMl) || 330;
      const bottlePkg = Number(product.bottlingConfig.bottleCost) || 0;
      const sellPrice = Number(product.bottlingConfig.sellPricePerBottle) || 0;
      const frac = bottleVol / yieldVol;
      const liquidCostPerBottle = Math.round(batchTotalCost * frac);
      const costPerBottle = liquidCostPerBottle + bottlePkg;
      const profitPerBottle = sellPrice - costPerBottle;
      const marginPerBottle = sellPrice > 0 ? Math.round((profitPerBottle / sellPrice) * 100) : 0;
      const bottlesPerBatch = Math.floor(yieldVol / bottleVol);
      const leftoverMl = Math.round(yieldVol - bottlesPerBatch * bottleVol);

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
        mainSubName: `Mẻ ${formatViNumber(yieldVol)}${yieldUnit}`,
        profitPerBatch: bottlesPerBatch * profitPerBottle
      };
    }

    return {
      ...product.toObject(),
      recipeMode: 'batch',
      batchSummary: {
        yieldVolume: yieldVol,
        yieldUnit,
        splitMode,
        rawBatchCost: Math.round(rawRecipeCost),
        wasteCost: batchWasteCost,
        batchTotalCost,
        costPerYieldUnit,
        costPer100: Math.round(costPerYieldUnit * 100),
        cupsPerBatch: baseVariant.cupsPerBatch,
        portionVolume: baseVariant.portionVolume,
        leftoverVolume: baseVariant.leftoverVolume,
        revenuePerBatch: baseVariant.revenuePerBatch,
        profitPerBatch: baseVariant.profitPerBatch
      },
      rawIngredientsCost: baseVariant.liquidCostPerCup + Math.round(perCupExtrasCost),
      wasteCost: Math.round(batchWasteCost * baseFrac),
      packagingCost,
      costPrice: baseVariant.costPrice,
      totalKcal: baseVariant.kcal,
      grossProfit: baseVariant.grossProfit,
      profitMargin: baseVariant.profitMargin,
      foodCostPercent: baseVariant.foodCostPercent,
      targetCostPercent,
      suggestedPrice: baseVariant.suggestedPrice,
      maxCupsPossible,
      hasTrackedIngredient,
      recipeDetails,
      perCupExtraDetails,
      subRecipeBreakdowns,
      variantBreakdowns,
      bottlingSummary
    };
  }

  // ==================== CHẾ ĐỘ A: PHA TRỰC TIẾP TỪNG LY (PER_CUP) ====================
  let maxCupsPossible = Infinity;
  let hasTrackedIngredient = false;

  for (const item of recipeDetails) {
    if (!item.trackInventory) {
      item.availableCups = null;
      continue;
    }
    hasTrackedIngredient = true;
    const cups = item.quantity > 0 && item.currentStock > 0 ? Math.floor(item.currentStock / item.quantity) : 0;
    item.availableCups = cups;
    if (cups < maxCupsPossible) maxCupsPossible = cups;
  }

  if (!hasTrackedIngredient) maxCupsPossible = 999;
  else if (maxCupsPossible === Infinity) maxCupsPossible = 0;

  const wasteCost = Math.round(rawRecipeCost * (wastePercent / 100));
  const costPrice = Math.round(rawRecipeCost + wasteCost + packagingCost);
  const grossProfit = product.price - costPrice;
  const profitMargin = product.price > 0 ? Math.round((grossProfit / product.price) * 100) : 0;
  const foodCostPercent = product.price > 0 ? Math.round((costPrice / product.price) * 100) : 0;
  const suggestedPrice = suggestRetailPrice(costPrice, targetCostPercent);

  const variantBreakdowns = [
    {
      name: baseSizeLabel,
      volumeMl: baseVolumeMl,
      scaleFactor: 1,
      isBase: true,
      price: product.price,
      packagingCost,
      costPrice,
      kcal: rawRecipeKcal,
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
      const vIngCost = rawRecipeCost * factor * (1 + wastePercent / 100);
      const vCost = Math.round(vIngCost + vPkg);
      const vKcal = Math.round(rawRecipeKcal * factor);
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

  let bottlingSummary = null;
  if (product.bottlingConfig && product.bottlingConfig.enabled) {
    const bottleVol = Number(product.bottlingConfig.bottleVolumeMl) || 330;
    const bottlePkg = Number(product.bottlingConfig.bottleCost) || 0;
    const sellPrice = Number(product.bottlingConfig.sellPricePerBottle) || 0;

    const liquidRatio = baseVolumeMl > 0 ? bottleVol / baseVolumeMl : 1;
    const liquidCostPerBottle = Math.round(rawRecipeCost * liquidRatio * (1 + wastePercent / 100));
    const costPerBottle = liquidCostPerBottle + bottlePkg;
    const profitPerBottle = sellPrice - costPerBottle;
    const marginPerBottle = sellPrice > 0 ? Math.round((profitPerBottle / sellPrice) * 100) : 0;

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
    recipeMode: 'per_cup',
    batchSummary: null,
    rawIngredientsCost: Math.round(rawRecipeCost),
    wasteCost,
    packagingCost,
    costPrice,
    totalKcal: rawRecipeKcal,
    grossProfit,
    profitMargin,
    foodCostPercent,
    targetCostPercent,
    suggestedPrice,
    maxCupsPossible,
    hasTrackedIngredient,
    recipeDetails,
    perCupExtraDetails: [],
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
