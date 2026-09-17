# ☕ CafeProfit - Webapp Quản Lý Lợi Nhuận & Giá Thành Quán Nước (Vite Frontend + Express Backend + MongoDB Atlas)

Hệ thống quản lý quán nước uống / cafe / trà sữa chuyên nghiệp được tách biệt thành 2 phần rõ rệt: **Frontend (Vite + Tailwind CSS)** và **Backend (Express + MongoDB Atlas)**, sẵn sàng để triển khai lên **Vercel** với tính năng Serverless tự động kết nối cơ sở dữ liệu đám mây.

---

## 🌟 Tính Năng Chính

1. **Định Lượng & Giá Thành 1 Ly Nước (BOM Costing)**:
   - Tự động tính chi phí nguyên vật liệu đầu vào (COGS) theo giá vốn thị trường.
   - Tính toán lãi gộp và % tỷ suất lợi nhuận (Margin) theo thời gian thực.
   - Tự động tính **Số ly tối đa có thể pha** dựa trên số lượng tồn kho nguyên liệu hiện có.
   - Modal phân tích chi tiết chi phí từng gram, mililit cấu thành 1 ly nước.

2. **Quản Lý Nguyên Liệu Đầu Vào & Tồn Kho (Inventory Management)**:
   - Danh mục 11 nguyên liệu thực tế (Cà phê hạt, sữa đặc, sữa tươi, trà đen, trà lài, siro đào, đào miếng, trân châu, đường, ly, ống hút...).
   - Đơn vị tính cơ sở chuẩn (`g`, `ml`, `cái`, `miếng`).
   - Cảnh báo sắp hết kho (Low stock alert).
   - **Phiếu Nhập Kho thông minh**: Tự động tính giá vốn bình quân gia quyền và tự động tạo phiếu Chi trong sổ quỹ.

3. **Bán Hàng Nhanh (POS) & Tự Động Trừ Kho**:
   - Giao diện bán hàng trực quan, phân loại danh mục, tìm kiếm nhanh.
   - Xem trước giá vốn và tiền lời của đơn hàng ngay trên giỏ hàng.
   - Bấm **Hoàn tất đơn**: Hệ thống **tự động trừ kho nguyên liệu** theo đúng công thức của từng món.
   - Tự động ghi nhận khoản Thu bán hàng vào Sổ Quỹ.

4. **Sổ Quỹ Thu - Chi (Cashflow)**:
   - Ghi nhận dòng tiền tự động từ đơn bán và nhập nguyên liệu.
   - Tạo phiếu thu/chi thủ công cho chi phí vận hành (Mặt bằng, Điện nước, Lương nhân viên, Đá lạnh...).
   - Báo cáo Tổng thu, Tổng chi và Số dư quỹ thực tế.

5. **Báo Cáo & Thống Kê Hoạt Động (Dashboard)**:
   - Biểu đồ xu hướng Doanh thu vs Giá vốn vs Lợi nhuận (Chart.js).
   - Bộ lọc linh hoạt: Hôm nay, 7 ngày qua, 30 ngày qua hoặc Toàn bộ.
   - Bảng xếp hạng Top món bán chạy nhất và cảnh báo tồn kho thấp.

---

## 📁 Cấu Trúc Dự Án (2 Phần Riêng Biệt)

```
QL_cafe/
├── backend/                       # PHẦN BACKEND (Node.js, Express, MongoDB Atlas)
│   ├── src/
│   │   ├── config/db.js           # Kết nối MongoDB Atlas
│   │   ├── models/                # Schema Mongoose (Ingredient, Product, Order, Transaction)
│   │   ├── routes/                # API Endpoints
│   │   └── utils/seeder.js        # Script nạp dữ liệu mẫu
│   ├── server.js                  # Máy chủ Express chạy local (Port 5000)
│   ├── package.json
│   └── .env                       # MONGODB_URI
├── frontend/                      # PHẦN FRONTEND (Vite + Tailwind CSS + HTML/JS)
│   ├── src/
│   │   ├── api.js                 # Gọi REST API (hỗ trợ proxy Vite dev server)
│   │   ├── main.js                # Xử lý toàn bộ logic giao diện, POS, Chart.js
│   │   └── style.css              # Custom styling & hiệu ứng
│   ├── index.html                 # Giao diện chính
│   ├── package.json               # Vite
│   └── vite.config.js             # Cấu hình proxy /api -> http://localhost:5000
├── api/
│   └── index.js                   # Cầu nối Vercel Serverless Function
├── vercel.json                    # Cấu hình Vercel build Vite & Serverless API
├── package.json                   # Root scripts điều phối
└── README.md
```

---

## 💻 Hướng Dẫn Chạy Cục Bộ (Local Development)

### 1. Cài đặt các gói phụ thuộc
Tại thư mục gốc dự án:
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Nạp dữ liệu mẫu vào MongoDB Atlas
```bash
npm run seed
```

### 3. Khởi động 2 phần (Frontend & Backend)
Mở 2 cửa sổ Terminal:
- **Cửa sổ 1 (Backend)**:
  ```bash
  npm run dev:backend
  ```
  *(Backend chạy tại `http://localhost:5000`)*

- **Cửa sổ 2 (Frontend Vite)**:
  ```bash
  npm run dev:frontend
  ```
  *(Frontend Vite mở tại `http://localhost:3000`)*

---

## 🚀 Hướng Dẫn Triển Khai Lên Vercel (1-Click Deploy)

### Bước 1: Đẩy mã nguồn lên GitHub
```bash
git add .
git commit -m "feat: Tách 2 phần Vite frontend và Express backend chuẩn Vercel"
git push -u origin main
```

### Bước 2: Import dự án vào Vercel
1. Đăng nhập vào [Vercel.com](https://vercel.com).
2. Nhấn nút **Add New...** -> **Project** -> Chọn Repository GitHub của bạn rồi bấm **Import**.
3. Tại phần **Environment Variables**, thêm biến sau:
   - **Key**: `MONGODB_URI`
   - **Value**: `mongodb+srv://towavnitminhnhan_db_user:GSbwCY6zDGlOPRFL@quanlycafe.vzwbzgw.mongodb.net/quanly_cafe?retryWrites=true&w=majority`
   - Nhấn **Add**.
4. Nhấn nút **Deploy**.
5. Vercel sẽ tự động build Vite frontend và kích hoạt Serverless API kết nối trực tiếp với MongoDB Atlas của bạn!

---

## 📄 Bản Quyền
Phát hành theo giấy phép [MIT](LICENSE).
