# Dự án sEMG Gesture Recognition TinyML trên ESP32-S3

Thư mục dự án: `/home/trithuc/Projects/DTYS`

## 1. Cấu trúc thư mục (Gọn gàng & Tối ưu)
```text
DTYS/
├── dataset/
│   └── EMG-data.csv              # Bộ dữ liệu thực tế đầy đủ 8 kênh sEMG
├── scripts/
│   ├── preprocessing.py          # Module lọc DSP (Notch 50Hz, Bandpass 20-450Hz, Sliding Window)
│   └── train_universal.py        # Pipeline đa năng huấn luyện TinyML tái sử dụng cho mọi dataset
├── models/
│   └── semg_model_universal.h    # File C Header TinyML nhúng trực tiếp vào ESP32-S3
├── firmware/
│   └── esp32_firmware_sample.ino # Mã nguồn mẫu Arduino/ESP-IDF cho ESP32-S3
├── reference_repos/              # Các mã nguồn mở tham khảo (sEMG_gesture, TinyML_Prosthetics)
├── script.md                     # Tài liệu đặc tả kỹ thuật và kế hoạch triển khai đề tài
└── README.md
```

## 2. Cách huấn luyện mô hình TinyML
Chỉ cần mở terminal ở bất kỳ đâu và gõ:
```bash
train_universal
```

Tùy biến nâng cao:
```bash
# Đổi kênh tín hiệu:
train_universal --channels channel1 channel2 channel5 channel6

# Xem danh sách tất cả tùy chọn:
train_universal --help
```
Kết quả mô hình C mới nhất sẽ tự động được lưu vào `models/semg_model_universal.h`.
