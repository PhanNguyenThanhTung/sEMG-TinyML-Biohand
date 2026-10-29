# TÀI LIỆU ĐẶC TẢ KỸ THUẬT VÀ KẾ HOẠCH TRIỂN KHAI
## ĐỀ TÀI: THIẾT KẾ HỆ THỐNG ĐIỀU KHIỂN CÁNH TAY GIẢ BẰNG sEMG VÀ TINYML TRÊN ESP32-S3 (MÔ PHỎNG 3D)

---

## 1. THÔNG TIN CHUNG VÀ MỤC TIÊU DỰ ÁN

### 1.1. Thông tin đề tài
- **Tên đề tài:** Thiết kế hệ thống điều khiển cánh tay giả bằng tín hiệu điện cơ bề mặt (sEMG), ứng dụng TinyML trên ESP32-S3 và mô phỏng bàn tay 3D trên máy tính.
- **Nền tảng vi điều khiển:** ESP32-S3 (Dual-core Xtensa LX7, hỗ trợ tập lệnh vector AI/DSP, tích hợp USB-Serial-JTAG).
- **Môi trường nhúng:** ESP-IDF (C/C++), FreeRTOS.
- **Môi trường suy luận TinyML:** TensorFlow Lite for Microcontrollers (TFLite Micro) / ESP-NN.
- **Môi trường mô phỏng hiển thị:** Unity 3D Engine (C#) & Python Dashboard (PyQtGraph/NumPy).

### 1.2. Mục tiêu kỹ thuật
1. Thu nhận tín hiệu điện cơ bề mặt ($sEMG$) từ cơ cẳng tay thông qua module tiền khuếch đại tương thích.
2. Xây dựng pipeline lọc tín hiệu số và trích xuất đặc trưng miền thời gian tối ưu tài nguyên trên vi điều khiển.
3. Chạy mô hình TinyML phân loại cử chỉ bàn tay thực thi trực tiếp trên ESP32-S3 (*On-device Inference*), không phụ thuộc vào máy tính tính toán.
4. Truyền dữ liệu và trạng thái qua giao thức USB Serial có cơ chế phát hiện lỗi và chống rung giật trạng thái (*Debounce / Majority Voting*).
5. Điều khiển mô hình 3D bàn tay chuyển động thời gian thực mượt mà trên môi trường máy tính.
6. Xây dựng toàn bộ hệ thống với khả năng đo đạc, kiểm chứng bằng các chỉ số định lượng (độ trễ, $F_1$-score, mức chiếm dụng bộ nhớ, độ ổn định tín hiệu).

---

## 2. NGUYÊN TẮC LÀM VIỆC VÀ VAI TRÒ HỆ THỐNG

### 2.1. Vai trò kỹ sư phụ trách
- Thực hiện vai trò kỹ sư Embedded Systems, xử lý tín hiệu y sinh (Biomedical DSP), TinyML và phần mềm mô phỏng.
- Phân tích và thiết kế theo nguyên tắc thực nghiệm: Mọi khẳng định kỹ thuật phải dựa trên số liệu đo đạc (Datasheet, Logic Analyzer, Oscilloscope, Terminal Logs), tuyệt đối không phỏng đoán tính năng phần cứng/phần mềm.

### 2.2. Nguyên tắc quản trị mã nguồn và thực thi CLI
- **Khảo sát trước khi sửa đổi:** Luôn kiểm tra cấu trúc mã nguồn, phiên bản thư viện ESP-IDF và SDK trước khi thực hiện chỉnh sửa.
- **Minh bạch ngữ cảnh dòng lệnh:** Phân biệt rõ giữa lệnh chạy trên máy tính phát triển (`[HOST-PC]`) và lệnh tương tác với thiết bị (`[TARGET-ESP32]`).
- **An toàn mã nguồn:** Nêu rõ tác động của lệnh trước khi nạp flash, xóa phân vùng hoặc thay đổi cấu hình SDK (`sdkconfig`).
- **Lựa chọn giải pháp:** Đánh giá trade-off giữa độ phức tạp tính toán, độ trễ, kích thước bộ nhớ và độ chính xác trước khi hiện thực hóa bất kỳ giải pháp nào.

---

## 3. KIẾN TRÚC HỆ THỐNG TỔNG THỂ

### 3.1. Sơ đồ khối luồng dữ liệu (Data Pipeline)

```text
[Điện cực bề mặt (sEMG)]
        │
        ▼
[Module AD8232 (Đã hiệu chỉnh lọc thông dải)]
        │
        ▼
[ADC ESP32-S3 (Continuous DMA, fs = 1000 Hz)]
        │
        ▼
[Bộ lọc số IIR (Notch 50Hz, Bandpass 20 - 450Hz)]
        │
        ▼
[Cửa sổ trượt (Window: 200ms, Stride: 50ms)]
        │
        ▼
[Trích xuất đặc trưng (RMS, MAV, WL, ZC)]
        │
        ▼
[TinyML Inference (TFLite Micro int8 / float32)]
        │
        ▼
[Post-processing & Quality Gate (Threshold + Majority Voting)]
        │
        ▼
[USB Serial Framing (Giao thức ASCII CSV)]
        │
        ▼
[Unity 3D Engine / Mô hình cánh tay mô phỏng]
```

### 3.2. Chi tiết các khối chức năng

#### A. Khối thu nhận tín hiệu sEMG (Phần cứng)
- **Số lượng kênh:** Giai đoạn 1 triển khai 2 kênh độc lập:
  - *Kênh 1:* Đặt tại nhóm cơ gấp cẳng tay (*Flexor Digitorum Superficialis*) phục vụ nhận diện cử chỉ nắm (`CLOSE_HAND`).
  - *Kênh 2:* Đặt tại nhóm cơ duỗi cẳng tay (*Extensor Digitorum Communis*) phục vụ nhận diện cử chỉ mở (`OPEN_HAND`).
  - *Điện cực tham chiếu (Reference):* Đặt tại vùng xương trung tính về điện sinh học (mỏm khuỷu tay gót - *Olecranon*).
- **Thẩm định & Điều chỉnh AD8232:**
  - *Vấn đề kỹ thuật:* AD8232 nguyên bản có cấu hình bộ lọc thông dải y tế phục vụ điện tim (ECG, $0.5\text{ Hz} - 40\text{ Hz}$). Tín hiệu sEMG có dải tần hoạt động chính từ $20\text{ Hz} - 450\text{ Hz}$.
  - *Giải pháp:* Tính toán lại các linh kiện $R, C$ ngoại vi trên module để mở rộng băng thông đáp ứng tần số lên dải $20\text{ Hz} - 500\text{ Hz}$, hoặc xuất tín hiệu sau tầng tiền khuếch đại vi sai để đưa trực tiếp vào bộ lọc số.
  - *Tương thích ADC:* Đo đạc điện áp DC bias và biên độ đỉnh-đỉnh ($V_{pp}$), thiết lập điện áp đầu vào nằm trọn trong dải đo tuyến tính của ADC ESP32-S3 (sử dụng mức suy hao `ADC_ATTEN_DB_12` với dải đo hiệu dụng xấp xỉ $0\text{ V} - 3.1\text{ V}$).

#### B. Khối Firmware ESP32-S3
- **Kiến trúc FreeRTOS đa nhiệm:**
  - `Task_ADC_Sampling` (Core 0, High Priority): Điều khiển lấy mẫu liên tục qua ADC DMA với Timer Trigger cố định tần số $f_s = 1000\text{ Hz}$. Đẩy mẫu thô vào Ring Buffer.
  - `Task_DSP_Inference` (Core 1, Medium Priority): Lấy dữ liệu từ buffer, thực thi lọc số IIR, chia khung cửa sổ, tính toán đặc trưng và gọi hàm `Invoke()` của TFLite Micro.
  - `Task_Serial_Comm` (Core 0, Low Priority): Đóng gói kết quả phân loại, kiểm tra điều kiện an toàn tín hiệu và truyền thông điệp qua cổng USB-Serial-JTAG/UART.
- **Tiền xử lý tín hiệu số (DSP):**
  - *Bandpass Filter:* Bộ lọc Butterworth bậc 4 thông dải từ $20\text{ Hz}$ đến $450\text{ Hz}$.
  - *Notch Filter:* Bộ lọc dừng dải hẹp IIR triệt tiêu nhiễu tần số công nghiệp $50\text{ Hz}$ và sóng hài.
  - *Sliding Window:* Chiều dài khung $N = 200\text{ ms}$ (tương ứng 200 mẫu tại $f_s = 1000\text{ Hz}$), bước nhảy $\Delta N = 50\text{ ms}$ (50 mẫu). Đảm bảo cập nhật dự đoán mỗi $50\text{ ms}$.
- **Trích xuất đặc trưng (Time-Domain Features):**
  - *Mean Absolute Value (MAV):* $\text{MAV} = \frac{1}{N}\sum_{i=1}^{N}|x_i|$
  - *Root Mean Square (RMS):* $\text{RMS} = \sqrt{\frac{1}{N}\sum_{i=1}^{N}x_i^2}$
  - *Waveform Length (WL):* $\text{WL} = \sum_{i=1}^{N-1}|x_{i+1} - x_i|$
  - *Zero Crossing (ZC):* Đếm số lần tín hiệu đổi dấu vượt qua ngưỡng biên độ xác định để khử nhiễu nền.

#### C. Khối Dataset & Mô hình TinyML
- **Bộ nhãn nhận diện (3 Classes):**
  1. `REST` (Cơ thả lỏng hoàn toàn).
  2. `OPEN_HAND` (Xòe căng bàn tay).
  3. `CLOSE_HAND` (Nắm chặt bàn tay).
- **Quy trình thu thập dữ liệu:**
  - Thực hiện thu thập theo phiên (Sessions), mỗi phiên gồm nhiều lần lặp co cơ ($3 - 5\text{ s}$) và nghỉ giữa các lần ($5\text{ s}$) nhằm hạn chế mỏi cơ (*Muscle Fatigue*).
  - Thu thập trên nhiều thời điểm trong ngày để ghi nhận sự thay đổi trở kháng tiếp xúc của da.
- **Chiến lược phân chia tập dữ liệu:**
  - Tuyệt đối không xáo trộn ngẫu nhiên (random split) các khung tín hiệu chồng lấn để tránh rò rỉ dữ liệu (*Data Leakage*). Phân chia Train/Validation/Test theo từng Session/Repetition hoàn toàn độc lập.
- **Kiến trúc mô hình TinyML:**
  - Mô hình MLP (Multi-Layer Perceptron) kích thước nhỏ: Input layer ($4 \text{ đặc trưng} \times 2 \text{ kênh} = 8\text{ nodes}$) $\rightarrow$ Hidden 1 (32 nodes, ReLU) $\rightarrow$ Hidden 2 (16 nodes, ReLU) $\rightarrow$ Output (3 nodes, Softmax).
  - Kích thước mô hình sau khi lượng tử hóa (PTQ int8 hoặc float32 tinh gọn): $< 30\text{ KB}$, thời gian thực thi $< 10\text{ ms}$ trên ESP32-S3.

#### D. Khối Ứng dụng PC & Mô phỏng 3D
- **Môi trường Unity:**
  - Nhập mô hình xương bàn tay 3D rigged hoàn chỉnh.
  - Thiết lập Animation Controller sử dụng `Blend Tree` hoặc nội suy trực tiếp góc quay các khớp xương ngón tay (`Quaternion.Slerp`) giữa các vị trí mục tiêu (Rest, Open, Close).
- **Thread xử lý Serial:**
  - Sử dụng luồng nền riêng biệt (`Background Thread`) đọc cổng COM để không làm tụt khung hình (FPS) của luồng dựng hình (Main Render Thread).
  - Triển khai cơ chế Timeout: Nếu mất tín hiệu quá $500\text{ ms}$, bàn tay tự động đưa về trạng thái `REST` an toàn.
- **Python Diagnostic Tool (Hỗ trợ hiệu chỉnh):**
  - Tool hiển thị đồ thị sóng thô, tính toán phổ biên độ FFT thời gian thực để thẩm định chất lượng dán điện cực và mức độ can nhiễu trước khi bắt đầu bài test.

---

## 4. GIAO THỨC TRUYỀN THÔNG USB SERIAL

### 4.1. Cấu hình vật lý
- **Giao diện:** USB CDC (Cổng USB ảo qua ESP32-S3 Native USB hoặc UART Bridge).
- **Baudrate:** $115200\text{ bps}$ (chế độ truyền lệnh điều khiển) hoặc $921600\text{ bps}$ (chế độ stream dữ liệu thô phục vụ thu dataset).
- **Cấu hình bit:** 8 Data bits, No Parity, 1 Stop bit (8N1).
- **Ký tự kết thúc thông điệp:** `\n` (LF) hoặc `\r\n` (CRLF).

### 4.2. Định dạng thông điệp

#### Gói tin điều khiển (Command Packet)
```
CMD,<GESTURE>,<CONFIDENCE>,<STATUS>\n
```
- `CMD`: Header định danh bản tin điều khiển.
- `<GESTURE>`: Cử chỉ nhận dạng (`REST`, `OPEN`, `CLOSE`, `UNKNOWN`).
- `<CONFIDENCE>`: Độ tin cậy đầu ra từ lớp Softmax, giá trị từ `0.00` đến `1.00`.
- `<STATUS>`: Trạng thái kiểm định an toàn:
  - `ACCEPT`: Tín hiệu thỏa mãn ngưỡng năng lượng và độ tin cậy $\ge T_{\text{threshold}}$ (mặc định $0.85$).
  - `REJECT`: Từ chối điều khiển do độ tin cậy thấp, biên độ cơ không đạt chuẩn hoặc phát hiện bất thường.

*Ví dụ:*
```text
CMD,OPEN,0.94,ACCEPT\n
CMD,CLOSE,0.91,ACCEPT\n
CMD,REST,0.98,ACCEPT\n
CMD,UNKNOWN,0.42,REJECT\n
```

#### Gói tin trạng thái hệ thống (Status Packet)
```
STATUS,<EVENT_CODE>\n
```
- `STATUS,MODEL_READY\n`: Hệ thống đã khởi tạo xong TFLite Micro và sẵn sàng.
- `STATUS,SIGNAL_BAD\n`: Biên độ tín hiệu vượt ngưỡng bão hòa hoặc đứt tiếp xúc điện cực (Lead-off).
- `STATUS,CALIBRATING\n`: Hệ thống đang trong trạng thái lấy mẫu baseline nhiễu nền tĩnh.

#### Gói tin đồng bộ và bắt tay (Handshake)
- Máy tính gửi: `PING\n`
- Vi điều khiển phản hồi: `PONG,READY\n`

---

## 5. QUY TRÌNH TRIỂN KHAI VÀ NGHIỆM THU THEO GIAI ĐOẠN

```
[GĐ 1: Phân tích & Đặc tả] 
        │
        ▼
[GĐ 2: Kiểm tra phần cứng & Đo đạc tín hiệu]
        │
        ▼
[GĐ 3: Xây dựng Dataset sEMG]
        │
        ▼
[GĐ 4: Huấn luyện & Tối ưu hóa TinyML]
        │
        ├─────────────────────────────┐
        ▼                             ▼
[GĐ 5: Phát triển Firmware]     [GĐ 6: Ứng dụng mô phỏng PC]
        │                             │
        └──────────────┬──────────────┘
                       ▼
        [GĐ 7: Tích hợp hệ thống & Đo kiểm]
                       │
                       ▼
        [GĐ 8: Hoàn thiện tài liệu & Bàn giao]
```

### Chi tiết 8 giai đoạn

| Giai đoạn | Nhiệm vụ chính | Đầu vào | Sản phẩm đầu ra | Tiêu chuẩn nghiệm thu |
| :--- | :--- | :--- | :--- | :--- |
| **GĐ 1: Phân tích & Đặc tả** | Khảo sát đáp ứng sEMG, thiết lập sơ đồ khối, xác định footprint phần cứng và giao thức. | Bản yêu cầu kỹ thuật | - Tài liệu đặc tả hệ thống.<br>- Bảng phân bổ chân GPIO/ADC.<br>- Đặc tả giao thức Serial. | Không xung đột tài nguyên phần cứng, định nghĩa interface rõ ràng. |
| **GĐ 2: Kiểm tra phần cứng** | Thẩm định module AD8232, đo đạc đáp ứng xung/tần số, phối hợp trở kháng và dải áp ADC. | Module AD8232, ESP32-S3, Oscilloscope | - Báo cáo đo đạc phần cứng.<br>- Schematic chỉnh sửa mạch lọc AD8232. | Tín hiệu ra không méo/clipping; $V_{pp}$ nằm trong dải tuyến tính ADC. |
| **GĐ 3: Xây dựng Dataset** | Viết tool log dữ liệu qua Serial, quy chuẩn hóa vị trí gắn điện cực, thu thập dữ liệu 3 cử chỉ. | Bộ gá điện cực, script Python logger | - Bộ dữ liệu sEMG định dạng `.csv`.<br>- Báo cáo phân tích FFT và SNR tín hiệu. | Tối thiểu 50 mẫu lặp/cử chỉ; tỷ lệ $SNR \ge 15\text{ dB}$ giữa lúc co cơ và nghỉ. |
| **GĐ 4: Huấn luyện TinyML** | Trích xuất đặc trưng MAV/RMS/WL/ZC, huấn luyện mô hình MLP/CNN, lượng tử hóa. | Dataset thô từ Giai đoạn 3 | - Model file `.tflite`.<br>- File mảng byte C++ (`model_data.h`).<br>- Confusion Matrix báo cáo. | $F_1$-score $\ge 90\%$ trên tập Test độc lập; Kích thước mô hình $< 30\text{ KB}$. |
| **GĐ 5: Phát triển Firmware** | Cấu hình ESP-IDF, Timer ADC lấy mẫu, bộ lọc số IIR, nạp TFLite Micro, format chuỗi Serial. | ESP-IDF SDK, `model_data.h` | - Toàn bộ mã nguồn Firmware ESP32-S3. | Sai số lấy mẫu $< 1\%$; thời gian suy luận on-chip $< 15\text{ ms}$. |
| **GĐ 6: Phát triển Ứng dụng PC**| Tạo project Unity 3D, import bàn tay rigged, lập trình bộ đọc Serial đa luồng, xử lý animation. | Unity Engine, Asset bàn tay 3D | - Ứng dụng Unity hoàn chỉnh (Executable). | Phản hồi đúng gói tin Serial; Animation chuyển động mượt mà, không giật khung hình. |
| **GĐ 7: Tích hợp hệ thống** | Đấu nối toàn trình, đo đạc độ trễ từ lúc co cơ đến khi mô hình 3D phản hồi, kiểm thử nhiễu. | Kết quả từ GĐ 1 đến GĐ 6 | - Bản ghi log kiểm thử tích hợp.<br>- Video thực nghiệm toàn trình. | Độ trễ toàn trình $< 150\text{ ms}$; không phát lệnh sai khi cơ ở trạng thái nghỉ. |
| **GĐ 8: Hoàn thiện & Đóng gói**| Tối ưu cấu trúc thư mục, hoàn thiện hướng dẫn build, đóng gói báo cáo kỹ thuật. | Toàn bộ mã nguồn và dữ liệu | - Báo cáo tổng kết đồ án.<br>- Tài liệu hướng dẫn cài đặt và vận hành. | Người khác có thể build và chạy lại toàn bộ hệ thống theo hướng dẫn từng bước. |

---

## 6. TIÊU CHÍ ĐÁNH GIÁ ĐỊNH LƯỢNG

Hệ thống được nghiệm thu dựa trên các chỉ số định lượng có thể đo đạc độc lập:

1. **Chỉ số tín hiệu sinh học:**
   - Tần số lấy mẫu thực tế: $f_s = 1000\text{ Hz} \pm 10\text{ Hz}$.
   - Tỷ số tín hiệu trên nhiễu: $\text{SNR} \ge 15\text{ dB}$ (tính toán dựa trên công suất tín hiệu khi co cơ cực đại so với baseline nghỉ).
2. **Chỉ số hiệu năng TinyML:**
   - Độ chính xác tổng thể (Overall Accuracy) trên tập kiểm thử độc lập: $\ge 90\%$.
   - $F_1$-Score cho từng lớp (`REST`, `OPEN`, `CLOSE`): $\ge 0.88$.
   - Tỷ lệ phát hiện sai trạng thái nghỉ (False Positive Rate at Rest): $\le 2\%$.
3. **Chỉ số thời gian thực và độ trễ:**
   - Thời gian trích xuất đặc trưng + suy luận TinyML trên ESP32-S3: $\le 15\text{ ms}$.
   - Độ trễ toàn trình (từ thời điểm co cơ đạt ngưỡng đến khi mô hình 3D bắt đầu đổi trạng thái): $\le 150\text{ ms}$.
4. **Mức độ tiêu hao tài nguyên phần cứng:**
   - Dung lượng bộ nhớ SRAM tiêu hao: $\le 50\%$ tổng dung lượng khả dụng của ESP32-S3.
   - Dung lượng bộ nhớ Flash tiêu hao: $\le 30\%$.
5. **Độ ổn định truyền thông:**
   - Tỷ lệ lỗi gói tin trên giao tiếp USB Serial: $< 0.05\%$.
   - Thời gian tự phục hồi khi kết nối Serial bị ngắt đột ngột: $\le 1\text{ s}$ sau khi cắm lại.

---

## 7. QUY TRÌNH AN TOÀN ĐIỆN SINH HỌC (BIOMEDICAL SAFETY)

Do hệ thống kết nối trực tiếp điện cực dẫn điện lên cơ thể người, các yêu cầu an toàn sau là bắt buộc:

1. **Yêu cầu về nguồn cấp:**
   - Khi dán điện cực lên người, ESP32-S3 **phải được cấp nguồn bằng pin** (Pin Li-ion $3.7\text{ V}$ qua mạch giảm áp chất lượng cao) hoặc máy tính xách tay đang chạy bằng pin (đã ngắt hoàn toàn adapter sạc khỏi lưới điện $220\text{V}$).
   - Tuyệt đối không cắm cổng USB của ESP32-S3 vào máy tính để bàn (PC) hoặc sạc cắm nguồn điện lưới trừ khi có thiết bị cách ly quang/cách ly số chuyên dụng (USB Isolator tuân thủ chuẩn an toàn y tế IEC 60601-1).
2. **Kiểm tra an toàn điện trước khi thử nghiệm:**
   - Sử dụng đồng hồ vạn năng kiểm tra điện áp tĩnh và điện trở giữa các cực của module và đất bảo vệ trước khi gắn lên cơ thể.
   - Luôn sử dụng điện cực Ag/AgCl đạt chuẩn y tế kèm gel dẫn điện để đảm bảo trở kháng tiếp xúc ổn định, tránh kích ứng da.
3. **Cơ chế dừng an toàn (Fail-Safe Mechanism):**
   - Bất kỳ khi nào vi điều khiển phát hiện tín hiệu bão hòa kéo dài (dấu hiệu đứt dây hoặc chạm chập nguồn), hệ thống phải lập tức phát cờ `SIGNAL_BAD`, vô hiệu hóa các lệnh điều khiển và đưa mô hình về trạng thái `REST`.

---

## 8. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
semg-tinyml-prosthetic-hand/
├── docs/                               # Tài liệu thiết kế, báo cáo kỹ thuật
│   ├── schematics/                     # Sơ đồ mạch Altium / PDF
│   └── protocol_spec.md                # Đặc tả chi tiết giao thức Serial
├── hardware/                           # Thiết kế phần cứng
│   └── altium/                         # Project nguyên lý và layout PCB
├── firmware/                           # Mã nguồn ESP32-S3 (ESP-IDF)
│   ├── main/
│   │   ├── CMakeLists.txt
│   │   ├── main.c                      # Khởi tạo FreeRTOS tasks
│   │   ├── adc_sampler.c               # Quản lý Timer & ADC DMA Continuous
│   │   ├── adc_sampler.h
│   │   ├── dsp_pipeline.c              # Bộ lọc số IIR và trích xuất đặc trưng
│   │   ├── dsp_pipeline.h
│   │   ├── tinyml_engine.cpp           # Wrapper TFLite Micro runtime
│   │   ├── tinyml_engine.h
│   │   ├── serial_protocol.c           # Đóng gói và truyền nhận bản tin Serial
│   │   └── serial_protocol.h
│   ├── components/                     # Thư viện tflite-micro, esp-nn
│   ├── partitions.csv                  # Bảng phân vùng Flash
│   ├── sdkconfig.defaults              # Cấu hình chuẩn cho ESP-IDF
│   └── CMakeLists.txt
├── ml/                                 # Nghiên cứu và huấn luyện mô hình
│   ├── data/                           # Dataset sEMG (.csv) đã gán nhãn
│   ├── notebooks/
│   │   ├── 01_serial_logger.py         # Công cụ thu log tín hiệu qua COM port
│   │   ├── 02_signal_analysis.ipynb    # Phân tích FFT, lọc số, thẩm định SNR
│   │   ├── 03_feature_engineering.py   # Tính toán MAV, RMS, WL, ZC
│   │   └── 04_train_quantize.ipynb     # Huấn luyện MLP và xuất mảng C++
│   └── exported_models/                # File .tflite và model_data.h
├── pc_app/                             # Ứng dụng điều khiển và hiển thị PC
│   ├── unity_prosthetic_hand/          # Dự án Unity mô phỏng 3D
│   │   └── Assets/
│   │       ├── Models/                 # 3D Rigged Hand Asset
│   │       └── Scripts/
│   │           ├── SerialController.cs # Quản lý luồng kết nối Serial
│   │           └── HandKinematics.cs   # Điều khiển chuyển động các khớp
│   └── diagnostic_gui/                 # Tool đồ thị kiểm tra tín hiệu Python
│       └── real_time_monitor.py
└── README.md                           # Hướng dẫn chi tiết cách build, nạp và chạy
```

---

## 9. KẾ HOẠCH HÀNH ĐỘNG TIẾP THEO

1. **Xác minh phần cứng:** Tiến hành đo đạc tín hiệu ra thực tế từ module AD8232 trên dao động ký (Oscilloscope) với tải mô phỏng hoặc cơ bắp thật.
2. **Thiết lập môi trường mã nguồn:** Khởi tạo khung dự án ESP-IDF trên repository và cấu hình driver ADC DMA với tần số $1000\text{ Hz}$.
3. **Xây dựng Script thu nhận dữ liệu:** Viết công cụ Python ghi nhận tín hiệu sEMG đồng bộ với giao diện hướng dẫn người dùng co/duỗi cơ để chuẩn bị cho Giai đoạn 3.