# TÀI LIỆU KỸ THUẬT VÀ ĐẶC TẢ MÔ HÌNH TINYML (README_MODEL)
## Đề tài: Nhận diện cử chỉ tay từ tín hiệu sEMG bằng TensorFlow Lite for Microcontrollers trên ESP32-S3

---

## 1. HƯỚNG DẪN CÀI ĐẶT & CHẠY DÀNH CHO TEAMMATE (SETUP GUIDE)

Do các file dataset nặng (`.csv`) và môi trường ảo (`venv/`) không được push lên GitHub để tối ưu dung lượng repo, teammate sau khi clone project về máy chỉ cần làm theo **3 bước chuẩn** dưới đây:

### Bước 1: Chuẩn bị Dataset
1. Nhận file `EMG-data.csv` từ nhóm (qua Google Drive / USB / NAS).
2. Tạo thư mục `dataset/` (nếu chưa có) và copy file vào đúng đường dẫn:
   ```text
   sEMG-TinyML-Biohand/model_tinyml/dataset/EMG-data.csv
   ```

### Bước 2: Cài đặt môi trường Python (Chỉ làm 1 lần)
Mở terminal tại thư mục `model_tinyml`:
```bash
cd model_tinyml

# 1. Khởi tạo môi trường ảo Python
python3 -m venv venv

# 2. Kích hoạt môi trường ảo
# Trên Linux / macOS:
source venv/bin/activate
# Trên Windows (PowerShell):
# .\venv\Scripts\Activate.ps1

# 3. Cài đặt toàn bộ thư viện phụ thuộc từ requirements.txt
pip install --upgrade pip
pip install -r requirements.txt
```

### Bước 3: Huấn luyện và xuất mô hình TinyML
Chạy script huấn luyện với bộ 6 đặc trưng tối ưu:
```bash
python scripts/train_tensorflow_tinyml.py
```
* Sau khi chạy xong, kết quả kiểm thử (**Test Accuracy $\approx 92.22\%$**) sẽ in ra màn hình.
* File C++ Header nhúng cho ESP32-S3 sẽ tự động được sinh ra tại:
  `models/model_data.h`

---

## 2. TỔNG QUAN VỀ MÔ HÌNH (MODEL OVERVIEW)

Hệ thống sử dụng mạng nơ-ron truyền thẳng đa tầng (**Multi-Layer Perceptron - MLP**) được tối ưu hóa theo chuẩn **TinyML (TensorFlow Lite for Microcontrollers - TFLM)** nhằm thực thi trực tiếp trên vi điều khiển **ESP32-S3** mà không cần kết nối máy chủ hay đám mây.

* **Nhiệm vụ:** Phân loại 3 trạng thái cử chỉ bàn tay thời gian thực:
  * `Lớp 0 (REST)`: Bàn tay thả lỏng hoàn toàn.
  * `Lớp 1 (CLOSE_HAND)`: Bàn tay nắm chặt (Fist).
  * `Lớp 6 (OPEN_HAND)`: Bàn tay xòe căng (Extended Palm).
* **Độ chính xác kiểm thử (Test Accuracy 80/20):** **`92.22%`**
* **Dung lượng file nhị phân TFLite:** `6.760 bytes` ($\approx 6.6\text{ KB}$).
* **Kích thước C++ Header nhúng:** `models/model_data.h`.
* **Độ trễ suy luận on-chip (Inference Latency):** $\le 5\text{ ms}$ trên nhân Xtensa LX7 (240MHz).

---

## 3. DỮ LIỆU ĐẦU VÀO VÀ BỐ TRÍ KÊNH CẢM BIẾN (CHANNELS)

Hệ thống sử dụng **2 kênh tín hiệu sEMG độc lập** đặt tại các nhóm cơ đối kháng trên cẳng tay:
* **Kênh 1 (`channel4`):** Đặt tại nhóm cơ gấp (*Flexor Digitorum Superficialis*) mặt trước cẳng tay — chuyên bắt cử chỉ **Nắm tay (`CLOSE_HAND`)**.
* **Kênh 2 (`channel7`):** Đặt tại nhóm cơ duỗi (*Extensor Digitorum Communis*) mặt sau cẳng tay — chuyên bắt cử chỉ **Xòe tay (`OPEN_HAND`)**.
* **Tần số lấy mẫu:** $f_s = 1000\text{ Hz}$ ($1\text{ ms}$/mẫu).
* **Cửa sổ trượt (Sliding Window):** Chiều dài $200\text{ ms}$ ($200$ mẫu), bước nhảy $\Delta t = 25\text{ ms}$ (độ chồng lấn $87.5\%$).

---

## 4. BỘ 6 ĐẶC TRƯNG THỜI GIAN VÀNG (EXTENDED HUDGINS SET)

Để nén 200 điểm sóng thô thành một vector cô đọng cho AI, mỗi kênh được trích xuất đúng **6 đặc trưng thời gian**:

| STT | Ký hiệu | Tên đặc trưng | Công thức toán học | Ý nghĩa vật lý sinh học |
| :---: | :---: | :--- | :---: | :--- |
| **1** | **RMS** | Root Mean Square | $\sqrt{\frac{1}{N}\sum_{i=1}^N x_i^2}$ | Đo công suất và năng lượng co cơ. Tăng vọt khi gồng cơ mạnh. |
| **2** | **MAV** | Mean Absolute Value | $\frac{1}{N}\sum_{i=1}^N \|x_i\|$ | Đo biên độ co cơ trung bình (tương đương đường bao Envelope). |
| **3** | **WL** | Waveform Length | $\sum_{i=1}^{N-1} \|x_{i+1} - x_i\|$ | Đo độ phức tạp và độ nhấp nhô liên tục của dạng sóng co cơ. |
| **4** | **ZC** | Zero Crossing | $\sum [x_i \cdot x_{i+1} < 0]$ | Đo tần số dao động co cơ, triệt tiêu nhiễu nền tần số thấp. |
| **5** | **SSC** | Slope Sign Changes | $\sum [(x_i - x_{i-1})(x_i - x_{i+1}) > 0]$ | Đo mật độ kích hoạt của các đơn vị vận động cơ bắp (Motor Units). |
| **6** | **WAMP** | Willison Amplitude | $\sum [\|x_{i+1} - x_i\| > \text{threshold}]$ | Đo mức độ kích hoạt co cơ thực thụ, loại bỏ nhiễu chập chờn. |

👉 **Vector đầu vào AI ($X$):**
$$\mathbf{X} = [\underbrace{\text{RMS}_1, \text{MAV}_1, \text{WL}_1, \text{ZC}_1, \text{SSC}_1, \text{WAMP}_1}_{\text{Kênh 1 (Cơ Gập)}}, \quad \underbrace{\text{RMS}_2, \text{MAV}_2, \text{WL}_2, \text{ZC}_2, \text{SSC}_2, \text{WAMP}_2}_{\text{Kênh 2 (Cơ Duỗi)}}]$$
$$\text{Kích thước đầu vào (Input Nodes)} = 6 \text{ đặc trưng} \times 2 \text{ kênh} = \mathbf{12\text{ nodes}}$$

---

## 5. KIẾN TRÚC MẠNG NƠ-RON (MLP ARCHITECTURE)

Mô hình được xây dựng bằng **TensorFlow / Keras** gồm 3 tầng tính toán:

```text
[Input Layer: 12 nodes] (Vector 6 đặc trưng x 2 kênh)
       │
       ▼
[Dense Layer 1: 48 nodes, Activation = 'relu']
       │
       ▼
[Dropout Layer: Rate = 0.10] (Tắt ngẫu nhiên 10% nơ-ron chống học vẹt)
       │
       ▼
[Dense Layer 2: 24 nodes, Activation = 'relu']
       │
       ▼
[Output Layer: 3 nodes, Activation = 'softmax']
       │
       ▼
[Xác suất cử chỉ: P(REST), P(CLOSE_HAND), P(OPEN_HAND)]
```

### Các tham số huấn luyện:
* **Chiến lược phân chia:** 80% Train – 20% Test (Stratified Split).
* **Bộ tối ưu hóa (Optimizer):** Adam kết hợp hàm giảm tốc độ học `ExponentialDecay`.
* **Kích thước Mini-Batch:** `16`.
* **Cơ chế Early Stopping:** Tự động khôi phục bộ trọng số ở thời điểm đạt phong độ cao nhất (`restore_best_weights=True`).

---

## 6. KẾT QUẢ ĐÁNH GIÁ ĐỊNH LƯỢNG (BENCHMARK METRICS)

Mô hình đạt kết quả kiểm thử trên tập dữ liệu độc lập 20%:

### A. Ma trận phân loại (Classification Report)
```text
              Precision    Recall    F1-Score   Số mẫu test
Lớp 0 (Nghỉ)      0.92      0.92        0.92            90
Lớp 1 (Nắm)       0.87      0.87        0.87            46
Lớp 6 (Xòe)       0.98      0.98        0.98            44

Overall Accuracy: 92.22%
```

### B. Ma trận nhầm lẫn (Confusion Matrix)
| Thực tế \ Dự đoán | Đoán: Lớp 0 (Nghỉ) | Đoán: Lớp 1 (Nắm) | Đoán: Lớp 6 (Xòe) |
| :--- | :---: | :---: | :---: |
| **Thực: Lớp 0 (Nghỉ)** | **83** | 6 | 1 |
| **Thực: Lớp 1 (Nắm)** | 6 | **40** | 0 |
| **Thực: Lớp 6 (Xòe)** | 1 | 0 | **43** |

---

## 7. QUY TRÌNH NHÚNG TINYML VÀO ESP32-S3 (DEPLOYMENT)

### A. Lượng tử hóa Post-Training Quantization (PTQ)
* Ép toàn bộ ma trận trọng số sang số nguyên 8-bit (`int8`) thông qua TFLite Converter.
* Dung lượng mô hình nén xuống còn **$6.6\text{ KB}$**, tiết kiệm bộ nhớ SRAM quý giá của ESP32-S3.

### B. Triển khai trong Firmware ESP32-S3 (ESP-IDF / Arduino)
1. **Khởi tạo:**
   ```cpp
   #include "model_data.h"
   tflite::MicroInterpreter interpreter(model, resolver, tensor_arena, kTensorArenaSize);
   interpreter.AllocateTensors();
   ```
2. **Gán 12 đặc trưng vào Input:**
   ```cpp
   TfLiteTensor* input = interpreter.input(0);
   for (int i = 0; i < 12; i++) {
       input->data.f[i] = normalized_features[i];
   }
   ```
3. **Thực thi suy luận (Inference):**
   ```cpp
   interpreter.Invoke();
   ```
4. **Đọc xác suất Softmax và truyền Serial lên Unity 3D:**
   ```text
   CMD,OPEN,0.98,ACCEPT\n
   ```

---

## 8. HƯỚNG DẪN TÙY BIẾN DÒNG LỆNH (CLI OPTIONS)

```bash
# Chạy mặc định bộ 6 đặc trưng (100 Epochs, Batch size 16):
python scripts/train_tensorflow_tinyml.py

# Tùy biến số Epochs hoặc kênh khác:
python scripts/train_tensorflow_tinyml.py --epochs 120 --batch_size 32 --channels channel4 channel7
```
