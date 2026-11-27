require('dotenv').config();
const mongoose = require('mongoose');
const Ingredient = require('../models/Ingredient');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const { syncAllSubRecipes } = require('./costing');

async function seedData() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('Lỗi: MONGODB_URI chưa được thiết lập trong file .env');
      process.exit(1);
    }

    console.log('Đang kết nối MongoDB Atlas...');
    await mongoose.connect(mongoUri);
    console.log('Kết nối thành công!');

    await Ingredient.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Transaction.deleteMany({});
    console.log('Đã dọn dẹp dữ liệu cũ trên MongoDB Atlas...');

    // 1. Nguyên liệu đầu vào (có quy cách mua rõ ràng & cả mẫu Trà Lộc Phát)
    const ingredientsData = [
      { name: 'Cà phê Robusta mộc', unit: 'g', category: 'Cà phê', purchaseUnit: 'Bao', conversionRate: 1000, purchasePrice: 260000, costPerUnit: 260, stockQuantity: 4500, minStockAlert: 500, notes: '260.000đ/1kg' },
      { name: 'Sữa đặc Ngôi Sao Phương Nam', unit: 'g', category: 'Sữa & Béo', purchaseUnit: 'Lon', conversionRate: 1000, purchasePrice: 41000, costPerUnit: 41, stockQuantity: 3800, minStockAlert: 500, kcalPerUnit: 3.13, notes: '41.000đ/1kg' },
      { name: 'Sữa tươi Dalat Milk', unit: 'ml', category: 'Sữa & Béo', purchaseUnit: 'Hộp', conversionRate: 1000, purchasePrice: 38000, costPerUnit: 38, stockQuantity: 5000, minStockAlert: 1000, kcalPerUnit: 0.62, notes: '38.000đ/1 lít' },
      { name: 'Trà Ôlong Lộc Phát', unit: 'g', category: 'Trà & Thảo mộc', purchaseUnit: 'Gói', conversionRate: 1000, purchasePrice: 305000, costPerUnit: 305, stockQuantity: 2500, minStockAlert: 300, notes: '305.000đ/1kg' },
      { name: 'Sữa yến mạch Oatside', unit: 'ml', category: 'Sữa & Béo', purchaseUnit: 'Hộp', conversionRate: 1000, purchasePrice: 42000, costPerUnit: 42, stockQuantity: 6000, minStockAlert: 1000, kcalPerUnit: 0.46, notes: '42.000đ/1 lít' },
      { name: 'Nước đường Hàn Quốc', unit: 'ml', category: 'Đường & Syrup', purchaseUnit: 'Can', conversionRate: 25000, purchasePrice: 568000, costPerUnit: 22.72, stockQuantity: 10000, minStockAlert: 1000, kcalPerUnit: 2.8, notes: '568.000đ/25kg' },
      { name: 'Muối hầm Lộc Phát', unit: 'ml', category: 'Nguyên liệu khác', purchaseUnit: 'Gói', conversionRate: 500, purchasePrice: 21000, costPerUnit: 42, stockQuantity: 500, minStockAlert: 50, notes: '21.000đ/500g' },
      { name: 'Bắp trái tươi', unit: 'g', category: 'Topping', purchaseUnit: 'Trái', conversionRate: 200, purchasePrice: 5000, costPerUnit: 25, stockQuantity: 2000, minStockAlert: 400, kcalPerUnit: 1.03, notes: '5.000đ/1 trái (~200g)' },
      { name: 'Hương bắp', unit: 'ml', category: 'Đường & Syrup', purchaseUnit: 'Chai', conversionRate: 30, purchasePrice: 49000, costPerUnit: 1633.3333, stockQuantity: 60, minStockAlert: 10, notes: '49.000đ/30g' },
      { name: 'Bắp luộc chín (tách hạt)', unit: 'g', category: 'Topping', purchaseUnit: 'Phần', conversionRate: 300, purchasePrice: 7500, costPerUnit: 25, stockQuantity: 1500, minStockAlert: 300, kcalPerUnit: 1.2, notes: '7.500đ/300g' },
      { name: 'Bột năng', unit: 'g', category: 'Topping', purchaseUnit: 'Bao', conversionRate: 10000, purchasePrice: 255000, costPerUnit: 25.5, stockQuantity: 5000, minStockAlert: 500, kcalPerUnit: 3.75, notes: '255.000đ/10kg' },
      { name: 'Nước lọc pha chế', unit: 'ml', category: 'Nguyên liệu khác', purchaseUnit: 'Lít', conversionRate: 1000, purchasePrice: 0, costPerUnit: 0, stockQuantity: 0, minStockAlert: 0, trackInventory: false, notes: 'Không trừ kho' },
      { name: 'Đá bi làm nguội', unit: 'g', category: 'Nguyên liệu khác', purchaseUnit: 'Kg', conversionRate: 1000, purchasePrice: 0, costPerUnit: 0, stockQuantity: 0, minStockAlert: 0, trackInventory: false, notes: 'Không trừ kho' },
      { name: 'Nước luộc bắp', unit: 'ml', category: 'Nguyên liệu khác', purchaseUnit: 'Lít', conversionRate: 1000, purchasePrice: 0, costPerUnit: 0, stockQuantity: 0, minStockAlert: 0, trackInventory: false, notes: 'Không trừ kho' },
      { name: 'Ly nhựa PP 500ml + Nắp', unit: 'cái', category: 'Bao bì & Vật tư', purchaseUnit: 'Lốc', conversionRate: 50, purchasePrice: 32500, costPerUnit: 650, stockQuantity: 450, minStockAlert: 100, notes: '32.500đ/lốc 50 cái' },
      { name: 'Ống hút phi 8 & 12', unit: 'cái', category: 'Bao bì & Vật tư', purchaseUnit: 'Túi', conversionRate: 500, purchasePrice: 75000, costPerUnit: 150, stockQuantity: 450, minStockAlert: 100, notes: '75.000đ/500 ống' }
    ];

    const insertedIngredients = await Ingredient.insertMany(ingredientsData);
    const ingMap = {};
    insertedIngredients.forEach(i => { ingMap[i.name] = i._id; });

    // 2. Bán thành phẩm (Mẻ nấu chuẩn Trà Lộc Phát)
    const subRecipes = await Ingredient.insertMany([
      {
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
        instructions: 'Ủ trà Ôlong, lọc bã, hòa sữa đặc + muối + sữa yến mạch rồi cho đá bi làm nguội.',
        subRecipe: [
          { ingredient: ingMap['Trà Ôlong Lộc Phát'], quantity: 100 },
          { ingredient: ingMap['Sữa yến mạch Oatside'], quantity: 2000 },
          { ingredient: ingMap['Nước lọc pha chế'], quantity: 400 },
          { ingredient: ingMap['Sữa đặc Ngôi Sao Phương Nam'], quantity: 340 },
          { ingredient: ingMap['Muối hầm Lộc Phát'], quantity: 2.5 },
          { ingredient: ingMap['Đá bi làm nguội'], quantity: 700 }
        ]
      },
      {
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
        instructions: 'Xay nhuyễn bắp trái với nước luộc bắp, rây mịn, thêm hương bắp.',
        subRecipe: [
          { ingredient: ingMap['Bắp trái tươi'], quantity: 300 },
          { ingredient: ingMap['Nước luộc bắp'], quantity: 200 },
          { ingredient: ingMap['Hương bắp'], quantity: 7.5 }
        ]
      },
      {
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
        instructions: 'Trộn bắp luộc chín với bột năng, luộc chín và ngâm nước đường.',
        subRecipe: [
          { ingredient: ingMap['Bắp luộc chín (tách hạt)'], quantity: 200 },
          { ingredient: ingMap['Nước đường Hàn Quốc'], quantity: 100 },
          { ingredient: ingMap['Bột năng'], quantity: 300 }
        ]
      }
    ]);

    subRecipes.forEach(s => { ingMap[s.name] = s._id; });
    await syncAllSubRecipes();

    // 3. Menu đồ uống & Công thức (kèm nhiều size & đóng chai)
    const productsData = [
      {
        name: 'Trà Sữa Ôlong Bắp Non',
        category: 'Trà sữa',
        price: 38000,
        baseSizeLabel: 'Ly 500ml',
        baseVolumeMl: 500,
        packagingCost: 1300,
        packagingNote: 'Ly, muỗng, ống hút',
        wastePercent: 0,
        targetCostPercent: 30,
        description: 'Công thức chuẩn 2 tầng: Nước cốt trà sữa Ôlong + Sốt bắp + Trân châu bắp',
        image: '🌽',
        recipe: [
          { ingredient: ingMap['Nước cốt trà sữa Ôlong'], quantity: 150 },
          { ingredient: ingMap['Nước đường Hàn Quốc'], quantity: 15 },
          { ingredient: ingMap['Sốt bắp non'], quantity: 40 },
          { ingredient: ingMap['Trân châu bắp (thạch bắp)'], quantity: 60 }
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
      },
      {
        name: 'Cà phê sữa đá',
        category: 'Cà phê',
        price: 25000,
        baseSizeLabel: 'Ly M (350ml)',
        baseVolumeMl: 350,
        packagingCost: 0,
        wastePercent: 3,
        targetCostPercent: 35,
        description: 'Vị đậm đà cà phê hòa quyện sữa đặc thơm béo',
        image: '☕',
        recipe: [
          { ingredient: ingMap['Cà phê Robusta mộc'], quantity: 25 },
          { ingredient: ingMap['Sữa đặc Ngôi Sao Phương Nam'], quantity: 35 },
          { ingredient: ingMap['Ly nhựa PP 500ml + Nắp'], quantity: 1 },
          { ingredient: ingMap['Ống hút phi 8 & 12'], quantity: 1 }
        ],
        variants: [
          { name: 'Ly L (500ml)', volumeMl: 500, scaleFactor: 1.35, price: 32000, extraPackagingCost: 300 }
        ]
      },
      {
        name: 'Bạc xỉu 3 tầng',
        category: 'Cà phê',
        price: 29000,
        baseSizeLabel: 'Ly M (500ml)',
        baseVolumeMl: 500,
        packagingCost: 0,
        wastePercent: 3,
        targetCostPercent: 35,
        description: 'Hương vị nhẹ nhàng, nhiều sữa tươi béo ngậy',
        image: '🥛',
        recipe: [
          { ingredient: ingMap['Cà phê Robusta mộc'], quantity: 15 },
          { ingredient: ingMap['Sữa đặc Ngôi Sao Phương Nam'], quantity: 30 },
          { ingredient: ingMap['Sữa tươi Dalat Milk'], quantity: 80 },
          { ingredient: ingMap['Ly nhựa PP 500ml + Nắp'], quantity: 1 },
          { ingredient: ingMap['Ống hút phi 8 & 12'], quantity: 1 }
        ]
      }
    ];

    const insertedProducts = await Product.insertMany(productsData);

    // 4. Chi phí vận hành mẫu
    await Transaction.create([
      {
        type: 'expense',
        category: 'Tiền mặt bằng',
        amount: 3000000,
        description: 'Tiền thuê mặt bằng kiosk cafe',
        date: new Date(Date.now() - 5 * 86400000)
      },
      {
        type: 'expense',
        category: 'Điện nước & Internet',
        amount: 850000,
        description: 'Hóa đơn tiền điện chạy máy pha và tủ lạnh',
        date: new Date(Date.now() - 3 * 86400000)
      }
    ]);

    // 5. Đơn bán hàng mẫu
    const sampleOrders = [
      {
        orderCode: 'ORD-SAMPLE-1001',
        items: [
          { product: insertedProducts[0]._id, productName: 'Trà Sữa Ôlong Bắp Non (Ly 500ml)', variantName: 'Ly 500ml', scaleFactor: 1, price: 38000, cost: 11363, quantity: 3, subtotal: 114000 },
          { product: insertedProducts[1]._id, productName: 'Cà phê sữa đá', variantName: 'Ly M (350ml)', scaleFactor: 1, price: 25000, cost: 8975, quantity: 2, subtotal: 50000 }
        ],
        totalAmount: 164000,
        totalCost: 52039,
        paymentMethod: 'cash',
        createdAt: new Date(Date.now() - 1 * 86400000)
      },
      {
        orderCode: 'ORD-SAMPLE-2002',
        items: [
          { product: insertedProducts[0]._id, productName: 'Trà Sữa Ôlong Bắp Non (Ly 700ml)', variantName: 'Ly 700ml', scaleFactor: 1.4, price: 46000, cost: 16031, quantity: 2, subtotal: 92000 },
          { product: insertedProducts[2]._id, productName: 'Bạc xỉu 3 tầng', variantName: 'Ly M (500ml)', scaleFactor: 1, price: 29000, cost: 9215, quantity: 2, subtotal: 58000 }
        ],
        totalAmount: 150000,
        totalCost: 50492,
        paymentMethod: 'transfer',
        createdAt: new Date()
      }
    ];

    for (const ord of sampleOrders) {
      const saved = await Order.create(ord);
      await Transaction.create({
        type: 'income',
        category: 'Bán hàng',
        amount: ord.totalAmount,
        description: `Thu tiền đơn hàng #${ord.orderCode}`,
        relatedOrder: saved._id,
        date: ord.createdAt
      });
    }

    console.log('>>> Khởi tạo dữ liệu mẫu (kèm Trà Sữa Ôlong Bắp Non chuẩn Trà Lộc Phát) thành công!');
    process.exit(0);
  } catch (err) {
    console.error('Lỗi khi nạp dữ liệu:', err);
    process.exit(1);
  }
}

seedData();
