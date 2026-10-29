# 🖐️ sEMG-TinyML-Biohand 3D Simulator

Ứng dụng web 3D mô phỏng cử động cánh tay/bàn tay người (sử dụng Three.js và mô hình chuẩn WebXR Generic Right Hand), phục vụ cho đồ án **sEMG TinyML Biohand**.

---

## 🌟 Tính năng hiện tại (Bản Demo Phần mềm)
- **Mô hình 3D chuẩn WebXR:** Đầy đủ 25 khớp xương cử động mượt mà.
- **3 Trạng thái cử động chính:**
  1. `💤 Thả lỏng (Relax)`: Các ngón hơi cong tự nhiên.
  2. `✊ Nắm chặt (Fist)`: Bàn tay cuộn tròn thành nắm đấm, ngón cái ôm khép bên ngoài.
  3. `🖐️ Xòe tay (Open)`: 5 ngón tay duỗi thẳng và tản rộng ra hai bên.
- **Tương tác 3D đa năng:**
  - Chuột trái: Xoay bàn tay 360 độ.
  - Cuộn chuột: Phóng to / Thu nhỏ.
  - Chuột phải: Dịch chuyển vị trí.
- **Phím tắt nhanh trên bàn phím:**
  - Nhấn phím `1` $\rightarrow$ Thả lỏng.
  - Nhấn phím `2` $\rightarrow$ Nắm chặt.
  - Nhấn phím `3` $\rightarrow$ Xòe tay.
- **Hoạt động Offline 100%:** Toàn bộ thư viện Three.js và model `.glb` đã được tải sẵn trong thư mục, không phụ thuộc vào internet.
- **Sẵn sàng cho MCU:** Cấu trúc module tách biệt, dễ dàng thêm `Web Serial API` khi kết nối vi điều khiển qua cổng USB.

---

## 🚀 Hướng dẫn khởi chạy

Chỉ cần mở terminal tại thư mục `UI` và chạy một trong hai cách:

### Cách 1: Chạy file script tự động
```bash
cd /home/trithuc/Projects/sEMG-TinyML-Biohand/UI
./run.sh
```

### Cách 2: Dùng lệnh Python tiêu chuẩn
```bash
cd /home/trithuc/Projects/sEMG-TinyML-Biohand/UI
python3 -m http.server 8000
```
Sau đó mở trình duyệt Chrome hoặc Edge tại: **`http://localhost:8000`**

---

## 📁 Cấu trúc thư mục

```text
UI/
├── assets/
│   └── right.glb           # Model 3D bàn tay phải WebXR
├── css/
│   └── style.css           # Giao diện Dark Cyber / Biometrics Glassmorphism
├── js/
│   ├── app.js              # Quản lý Three.js scene, camera, lights, UI & sự kiện
│   └── handModel.js        # Ánh xạ khung xương FK, cấu hình 3 Poses và nội suy mượt
├── libs/                   # Thư viện Three.js, OrbitControls, GLTFLoader (Offline)
├── utils/                  # BufferGeometryUtils
├── index.html              # Trang chính
├── run.sh                  # Script khởi chạy nhanh
└── README.md
```
