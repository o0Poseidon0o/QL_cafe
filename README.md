# ☕ CafeProfit - Webapp Quản Lý Lợi Nhuận & Giá Thành Quán Nước Uống (Hỗ Trợ GitHub Pages)

Ứng dụng web quản lý quán cafe / trà sữa / nước uống **chạy 100% trực tiếp trên GitHub Pages**. Tự động lưu trữ dữ liệu an toàn trên trình duyệt (LocalStorage), hỗ trợ xuất/nhập file sao lưu (.JSON), tính giá thành định lượng 1 ly nước (BOM) và bán hàng trừ kho tự động.

---

## 🌟 Tính Năng Nổi Bật

1. **Menu & Định Lượng Giá Thành 1 Ly (Recipe & BOM Costing)**:
   - Tự động tính **Giá vốn nguyên liệu (COGS)** cho từng ly nước dựa trên đơn giá nguyên liệu.
   - Hiển thị trực quan **Lợi nhuận gộp** và **% Biên lợi nhuận (Margin)** trên mỗi ly.
   - Tự động tính **Số ly tối đa có thể pha** dựa trên số lượng tồn kho nguyên liệu hiện có.
   - Bảng phân tích chi tiết chi phí từng gram, mililit nguyên liệu cấu thành 1 ly nước.

2. **Quản Lý Nguyên Liệu Đầu Vào & Tồn Kho (Inventory)**:
   - Danh mục 11 nguyên liệu thực tế (Cà phê Robusta mộc, Sữa đặc, Sữa tươi Dalat Milk, Trà đen, Trà lài, Siro đào, Đào ngâm, Trân châu, Đường, Ly nhựa, Ống hút...).
   - Đơn vị tính cơ sở (`g`, `ml`, `cái`, `miếng`).
   - Cảnh báo tồn kho khi xuống dưới mức an toàn (Low stock alert).
   - **Phiếu Nhập Kho thông minh**: Tự động tính lại giá vốn bình quân gia quyền và tự động tạo phiếu Chi vào Sổ Thu Chi.

3. **Bán Hàng Nhanh (POS) & Trừ Kho Tự Động**:
   - Giao diện bán hàng trực quan, phân loại danh mục, tìm kiếm nhanh.
   - Tự động tính doanh thu, giá vốn và lãi gộp ngay trên giỏ hàng trước khi thanh toán.
   - Khi bấm **Hoàn tất đơn**, hệ thống **tự động trừ số lượng nguyên liệu trong kho** theo đúng công thức định lượng của từng món.
   - Tự động ghi nhận khoản Thu bán hàng vào Sổ Quỹ.

4. **Sổ Quỹ Thu - Chi (Cashflow Ledger)**:
   - Tự động ghi nhận dòng tiền Thu từ đơn hàng và Chi từ nhập kho.
   - Cho phép tạo các khoản Thu / Chi vận hành thủ công (Mặt bằng, Điện nước, Lương nhân viên, Đá lạnh, Sửa chữa máy móc...).
   - Báo cáo tổng thu, tổng chi và số dư quỹ thực tế.

5. **Báo Cáo & Lợi Nhuận (Analytics Dashboard)**:
   - Biểu đồ xu hướng Doanh thu vs Giá vốn nguyên liệu vs Lợi nhuận gộp (Chart.js).
   - Thống kê linh hoạt: Hôm nay, 7 ngày qua, 30 ngày qua hoặc Toàn bộ.
   - Thống kê Top món bán chạy nhất.

6. **Sao Lưu & Phục Hồi Dữ Liệu (Backup & Restore)**:
   - Nút **"Tải về file sao lưu (.JSON)"**: Lưu toàn bộ nguyên liệu, menu, đơn hàng về máy tính.
   - Nút **"Nhập dữ liệu từ file (.JSON)"**: Đồng bộ sang máy tính hoặc điện thoại khác dễ dàng.
   - Nút **"Khôi phục dữ liệu mẫu ban đầu"** để thiết lập lại quán cafe mẫu bất kỳ lúc nào.

---

## 🚀 Hướng Dẫn Đưa Lên GitHub & Kích Hoạt GitHub Pages

### Bước 1: Đẩy mã nguồn lên GitHub
Mở Terminal / PowerShell tại thư mục dự án và chạy:
```bash
# 1. Thêm toàn bộ file vào git
git add .

# 2. Tạo commit
git commit -m "feat: Khoi tao webapp quan ly loi nhuan quan nuoc chay truc tiep tren GitHub Pages"

# 3. Tạo repo mới trên GitHub (https://github.com/new), sau đó liên kết:
git branch -M main
git remote add origin https://github.com/<tai-khoan-cua-ban>/<ten-repo>.git

# 4. Đẩy code lên GitHub
git push -u origin main
```

---

### Bước 2: Cài đặt GitHub Pages để chạy Webapp

1. Trên trình duyệt, vào trang **Repository** của bạn trên GitHub.
2. Bấm vào tab **Settings** (ở thanh menu trên cùng của repo).
3. Ở menu bên trái, tìm và bấm vào mục **Pages** (dưới phần *Code and automation*).
4. Tại mục **Build and deployment**:
   - **Source**: Chọn `Deploy from a branch`.
   - **Branch**: Chọn nhánh `main` và thư mục `/(root)`.
   - Bấm nút **Save**.
5. Đợi khoảng 1 - 2 phút, GitHub sẽ cung cấp đường link website của bạn dạng:
   👉 **`https://<tai-khoan-cua-ban>.github.io/<ten-repo>/`**
6. Bạn chỉ cần click vào link đó là webapp sẽ chạy ngay lập tức trên máy tính hoặc điện thoại!

---

## 📁 Cấu Trúc Thư Mục Chuẩn Cho GitHub Pages

```
QL_cafe/
├── index.html                     # Trang chủ webapp (GitHub Pages nhận diện tự động)
├── css/
│   └── style.css                  # Custom styling & hiệu ứng
├── js/
│   ├── store.js                   # Engine lưu trữ dữ liệu trình duyệt (LocalStorage)
│   ├── api.js                     # Tầng API giao tiếp nội bộ
│   └── app.js                     # Xử lý giao diện người dùng, POS, BOM & Chart.js
├── README.md                      # Hướng dẫn chi tiết
└── .gitignore                     # Bỏ qua các file bảo mật
```

---

## 📄 Bản Quyền
Phát hành theo giấy phép [MIT](LICENSE).
