require('dotenv').config();
const mongoose = require('mongoose');
const Ingredient = require('../models/Ingredient');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');

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

    // 1. Nguyên liệu ban đầu
    const ingredientsData = [
      { name: 'Cà phê Robusta mộc', unit: 'g', category: 'Cà phê', costPerUnit: 260, stockQuantity: 4500, minStockAlert: 500, notes: 'Đóng bao 1kg = 260.000đ' },
      { name: 'Sữa đặc Ngôi Sao Phương Nam', unit: 'ml', category: 'Sữa & Béo', costPerUnit: 95, stockQuantity: 3800, minStockAlert: 500, notes: 'Hộp 380g ~ 36.000đ' },
      { name: 'Sữa tươi Dalat Milk', unit: 'ml', category: 'Sữa & Béo', costPerUnit: 38, stockQuantity: 5000, minStockAlert: 1000, notes: 'Bịch 1 lít = 38.000đ' },
      { name: 'Trà đen Phúc Long', unit: 'g', category: 'Trà & Thảo mộc', costPerUnit: 220, stockQuantity: 2500, minStockAlert: 300, notes: 'Túi 500g = 110.000đ' },
      { name: 'Trà lài hương sen', unit: 'g', category: 'Trà & Thảo mộc', costPerUnit: 240, stockQuantity: 2000, minStockAlert: 300, notes: 'Gói 500g = 120.000đ' },
      { name: 'Siro Đào Teisseire', unit: 'ml', category: 'Đường & Syrup', costPerUnit: 280, stockQuantity: 1500, minStockAlert: 200, notes: 'Chai 700ml = 196.000đ' },
      { name: 'Đào ngâm lon Kronos', unit: 'miếng', category: 'Topping', costPerUnit: 3500, stockQuantity: 50, minStockAlert: 15, notes: 'Lon 820g có ~10-12 miếng' },
      { name: 'Trân châu đen Royal', unit: 'g', category: 'Topping', costPerUnit: 60, stockQuantity: 3000, minStockAlert: 500, notes: 'Túi 1kg = 60.000đ' },
      { name: 'Đường cát trắng Biên Hòa', unit: 'g', category: 'Đường & Syrup', costPerUnit: 25, stockQuantity: 8000, minStockAlert: 1000, notes: 'Túi 1kg = 25.000đ' },
      { name: 'Ly nhựa PP 500ml + Nắp', unit: 'cái', category: 'Bao bì & Vật tư', costPerUnit: 650, stockQuantity: 450, minStockAlert: 100, notes: 'Lốc 50 cái = 32.500đ' },
      { name: 'Ống hút phi 8 & 12', unit: 'cái', category: 'Bao bì & Vật tư', costPerUnit: 150, stockQuantity: 450, minStockAlert: 100, notes: 'Túi 500 ống' }
    ];

    const insertedIngredients = await Ingredient.insertMany(ingredientsData);
    const ingMap = {};
    insertedIngredients.forEach(i => { ingMap[i.name] = i._id; });

    // 2. Menu đồ uống & Công thức
    const productsData = [
      {
        name: 'Cà phê đen đá',
        category: 'Cà phê',
        price: 20000,
        description: 'Cà phê pha phin truyền thống đậm vị',
        image: '☕',
        recipe: [
          { ingredient: ingMap['Cà phê Robusta mộc'], quantity: 25 },
          { ingredient: ingMap['Đường cát trắng Biên Hòa'], quantity: 15 },
          { ingredient: ingMap['Ly nhựa PP 500ml + Nắp'], quantity: 1 },
          { ingredient: ingMap['Ống hút phi 8 & 12'], quantity: 1 }
        ]
      },
      {
        name: 'Cà phê sữa đá',
        category: 'Cà phê',
        price: 25000,
        description: 'Vị đậm đà cà phê hòa quyện sữa đặc thơm béo',
        image: '🥤',
        recipe: [
          { ingredient: ingMap['Cà phê Robusta mộc'], quantity: 25 },
          { ingredient: ingMap['Sữa đặc Ngôi Sao Phương Nam'], quantity: 35 },
          { ingredient: ingMap['Ly nhựa PP 500ml + Nắp'], quantity: 1 },
          { ingredient: ingMap['Ống hút phi 8 & 12'], quantity: 1 }
        ]
      },
      {
        name: 'Bạc xỉu 3 tầng',
        category: 'Cà phê',
        price: 29000,
        description: 'Hương vị nhẹ nhàng, nhiều sữa tươi béo ngậy',
        image: '🥛',
        recipe: [
          { ingredient: ingMap['Cà phê Robusta mộc'], quantity: 15 },
          { ingredient: ingMap['Sữa đặc Ngôi Sao Phương Nam'], quantity: 30 },
          { ingredient: ingMap['Sữa tươi Dalat Milk'], quantity: 80 },
          { ingredient: ingMap['Ly nhựa PP 500ml + Nắp'], quantity: 1 },
          { ingredient: ingMap['Ống hút phi 8 & 12'], quantity: 1 }
        ]
      },
      {
        name: 'Trà đào cam sả',
        category: 'Trà trái cây',
        price: 38000,
        description: 'Trà lài thanh mát cùng đào giòn ngọt',
        image: '🍑',
        recipe: [
          { ingredient: ingMap['Trà lài hương sen'], quantity: 10 },
          { ingredient: ingMap['Siro Đào Teisseire'], quantity: 25 },
          { ingredient: ingMap['Đào ngâm lon Kronos'], quantity: 2 },
          { ingredient: ingMap['Đường cát trắng Biên Hòa'], quantity: 10 },
          { ingredient: ingMap['Ly nhựa PP 500ml + Nắp'], quantity: 1 },
          { ingredient: ingMap['Ống hút phi 8 & 12'], quantity: 1 }
        ]
      },
      {
        name: 'Trà sữa truyền thống trân châu',
        category: 'Trà sữa',
        price: 32000,
        description: 'Trà đen phối sữa tươi và trân châu đen dẻo dai',
        image: '🧋',
        recipe: [
          { ingredient: ingMap['Trà đen Phúc Long'], quantity: 12 },
          { ingredient: ingMap['Sữa đặc Ngôi Sao Phương Nam'], quantity: 25 },
          { ingredient: ingMap['Sữa tươi Dalat Milk'], quantity: 70 },
          { ingredient: ingMap['Trân châu đen Royal'], quantity: 40 },
          { ingredient: ingMap['Ly nhựa PP 500ml + Nắp'], quantity: 1 },
          { ingredient: ingMap['Ống hút phi 8 & 12'], quantity: 1 }
        ]
      }
    ];

    const insertedProducts = await Product.insertMany(productsData);

    // 3. Chi phí mặt bằng, điện nước
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

    // 4. Đơn bán hàng mẫu
    const sampleOrders = [
      {
        orderCode: 'ORD-SAMPLE-1001',
        items: [
          { product: insertedProducts[1]._id, productName: insertedProducts[1].name, price: 25000, cost: 10450, quantity: 2, subtotal: 50000 },
          { product: insertedProducts[0]._id, productName: insertedProducts[0].name, price: 20000, cost: 7675, quantity: 1, subtotal: 20000 }
        ],
        totalAmount: 70000,
        totalCost: 28575,
        paymentMethod: 'cash',
        createdAt: new Date(Date.now() - 2 * 86400000)
      },
      {
        orderCode: 'ORD-SAMPLE-2002',
        items: [
          { product: insertedProducts[3]._id, productName: insertedProducts[3].name, price: 38000, cost: 17300, quantity: 2, subtotal: 76000 },
          { product: insertedProducts[4]._id, productName: insertedProducts[4].name, price: 32000, cost: 11820, quantity: 2, subtotal: 64000 }
        ],
        totalAmount: 140000,
        totalCost: 58240,
        paymentMethod: 'transfer',
        createdAt: new Date(Date.now() - 1 * 86400000)
      },
      {
        orderCode: 'ORD-SAMPLE-3003',
        items: [
          { product: insertedProducts[2]._id, productName: insertedProducts[2].name, price: 29000, cost: 10060, quantity: 3, subtotal: 87000 }
        ],
        totalAmount: 87000,
        totalCost: 30180,
        paymentMethod: 'cash',
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

    console.log('>>> Khởi tạo dữ liệu mẫu lên MongoDB Atlas thành công!');
    process.exit(0);
  } catch (err) {
    console.error('Lỗi khi nạp dữ liệu:', err);
    process.exit(1);
  }
}

seedData();
