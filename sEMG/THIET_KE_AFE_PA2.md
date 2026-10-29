# THIẾT KẾ PHẦN CỨNG ANALOG FRONT-END (AFE) sEMG 2 KÊNH - PHƯƠNG ÁN 2
## Cấu hình: INA333 + MCP6004 + MCP6002 (Nguồn đơn 3.3V, Tích hợp DRL và Áp ảo 1.65V)

---

## 1. THÔNG SỐ KỸ THUẬT MỤC TIÊU

| Đại lượng | Giá trị thiết kế | Ghi chú kỹ thuật |
| :--- | :--- | :--- |
| Nguồn cấp ($V_{DD}$) | $3.3\text{ V}$ (Single Supply) | Đồng bộ trực tiếp với nguồn LDO và ADC của ESP32-S3 |
| Số lượng kênh đo | 2 kênh độc lập | Kênh 1: Cơ gấp (Flexor), Kênh 2: Cơ duỗi (Extensor) |
| Điện áp tham chiếu ảo ($V_{MID}$) | $1.65\text{ V}$ | Đệm trở kháng thấp từ cầu phân áp $3.3\text{ V} / 2$ |
| Dải tần thông qua (Bandwidth) | $20\text{ Hz} - 450\text{ Hz}$ | Chuẩn tín hiệu điện cơ bề mặt ($sEMG$) y sinh |
| Tầng lọc thông cao (HPF) | Bậc 1 ($f_c \approx 19.4\text{ Hz}$) | Chặn điện thế bán pin (DC offset $\pm 300\text{ mV}$) và trôi đường nền |
| Tầng lọc thông thấp (LPF) | Sallen-Key bậc 2 ($f_c \approx 450\text{ Hz}$) | Đáp ứng Butterworth ($Q \approx 0.73$), chống răng cưa cho ADC $f_s = 1000\text{ Hz}$ |
| Hệ số khuếch đại tầng 1 ($G_1$) | $10.1\times$ ($20.1\text{ dB}$) | Thiết lập bằng trở $R_G$ trên INA333 |
| Hệ số khuếch đại tầng 2 ($G_2$) | $84.3\times$ ($38.5\text{ dB}$) | Khuếch đại không đảo trên Op-amp MCP6004 |
| Hệ số khuếch đại tầng 3 ($G_3$) | $1.0\times$ ($0\text{ dB}$) | Tầng đệm lọc Sallen-Key để ổn định hệ số phẩm chất $Q$ |
| Tổng hệ số khuếch đại ($G_{total}$) | $851\times$ ($58.6\text{ dB}$) | $V_{in} = \pm 1.5\text{ mV} \rightarrow V_{out} = 1.65\text{ V} \pm 1.28\text{ V}$ |
| Dải điện áp đầu ra | $0.37\text{ V} - 2.93\text{ V}$ | Nằm trọn trong dải tuyến tính của ADC ESP32-S3 ($0.1\text{ V} - 3.1\text{ V}$) |
| Khử nhiễu đồng pha (CMRR) | $> 100\text{ dB}$ | Đạt được nhờ tầng In-Amp INA333 kết hợp vòng phản hồi DRL |

---

## 2. KIẾN TRÚC MẠCH VÀ SƠ ĐỒ KHỐI

```text
[Điện cực Vin+] ───[Lọc RF/ESD]───┐
                                   ├───> [INA333] ──>[C_AC]──>[Tầng 2: HPF + Gain]──>[Tầng 3: Sallen-Key LPF]───> Output CH1 (ADC)
[Điện cực Vin-] ───[Lọc RF/ESD]───┘       (G1=10.1x)           (fc=19.4Hz, G2=84.3x)       (fc=450Hz, G3=1x)
                                             │                         │                          │
[Cầu phân áp 3.3V] ──>[Đệm MCP6002_A] ───────┴─────────────────────────┴──────────────────────────┴─────> V_MID (1.65V)
                               │
[Trích điện áp CM] ────────────┼────────> [Mạch DRL: MCP6002_B] ───[R_limit 390k]───> Điện cực tham chiếu (Olecranon)
                                         (Đảo pha nhiễu 50Hz)
```

---

## 3. TÍNH TOÁN CHI TIẾT TỪNG TẦNG KHUẾCH ĐẠI & LỌC

### 3.1. Tầng bảo vệ đầu vào và lọc nhiễu RF (Input RF / EMI Filter)
Tín hiệu sEMG có trở kháng nguồn rất lớn từ giao diện da - điện cực ($10\text{ k}\Omega - 100\text{ k}\Omega$). Sóng RF từ phát sóng Wi-Fi của ESP32 có thể bị giải điều chế thành điện áp DC lệch tại ngõ vào In-Amp.
- Mạng lọc gồm 2 điện trở nối tiếp $R_{in1} = R_{in2} = 10\text{ k}\Omega$ (sai số 1%).
- Tụ lọc vi sai $C_{diff} = 4.7\text{ nF}$ đặt giữa $IN+$ và $IN-$.
- Tụ lọc đồng pha $C_{cm1} = C_{cm2} = 470\text{ pF}$ nối từ mỗi ngõ vào về AGND.
- Tần số cắt lọc vi sai:
  $$f_{c,diff} = \frac{1}{2\pi (2 R_{in}) C_{diff}} = \frac{1}{2\pi \times 20000 \times 4.7 \times 10^{-9}} \approx 1.69\text{ kHz}$$
- Tần số cắt lọc đồng pha:
  $$f_{c,cm} = \frac{1}{2\pi R_{in} C_{cm}} = \frac{1}{2\pi \times 10000 \times 470 \times 10^{-12}} \approx 33.8\text{ kHz}$$
Mạng lọc này cho dải tín hiệu sEMG ($20 - 450\text{ Hz}$) đi qua không suy hao, đồng thời chặn toàn bộ xung nhiễu cao tần.

### 3.2. Tầng 1: Khuếch đại đo lường INA333
- Hàm truyền của INA333:
  $$V_{OUT,INA} = V_{REF} + G_1 \times (V_{IN+} - V_{IN-})$$
  $$G_1 = 1 + \frac{100\text{ k}\Omega}{R_G}$$
- Chân $V_{REF}$ nối trực tiếp vào điện áp ảo $V_{MID} = 1.65\text{ V}$.
- Lý do chọn $G_1 \approx 10\times$:
  Điện cực dán $Ag/AgCl$ tạo ra điện thế bán pin (half-cell potential) có thể lên đến $\pm 300\text{ mV}$. Nếu đặt $G_1 = 100\times$, điện áp DC lệch tại ngõ ra sẽ là $\pm 300\text{ mV} \times 100 = \pm 30\text{ V}$, làm bão hòa tức thì ngõ ra về $0\text{ V}$ hoặc $3.3\text{ V}$.
  Với $G_1 \approx 10\times$, độ lệch DC tại ngõ ra chỉ ở mức $\pm 100\text{ mV} \times 10 = \pm 1.0\text{ V}$, điện áp ra dao động trong khoảng $0.65\text{ V} - 2.65\text{ V}$, nằm an toàn trong dải nguồn $0 - 3.3\text{ V}$.
- Tính toán điện trở $R_G$:
  $$R_G = \frac{100\text{ k}\Omega}{G_1 - 1} = \frac{100\text{ k}\Omega}{10 - 1} \approx 11.11\text{ k}\Omega$$
  Chọn giá trị chuẩn E96: $R_G = 11.0\text{ k}\Omega$ (1%).
  $$G_1 = 1 + \frac{100\text{ k}\Omega}{11.0\text{ k}\Omega} = 10.09\times \approx 10.1\times$$

### 3.3. Tầng 2: Lọc thông cao (HPF) và khuếch đại trung gian
Tầng này có 2 nhiệm vụ: triệt tiêu hoàn toàn thành phần trôi đường nền DC do điện thế phân cực điện cực sinh ra, đồng thời nâng biên độ tín hiệu lên mức volt.
- Cấu hình: Bộ ghép xoay chiều (AC Coupling) thụ động phối hợp mạch khuếch đại không đảo trên 1 cổng Op-amp MCP6004.
- Tụ liên tầng $C_1 = 1.0\ \mu\text{F}$ (loại gốm nhiều lớp X7R hoặc film).
- Điện trở định thiên $R_1 = 8.2\text{ k}\Omega$ nối vào đường $V_{MID} = 1.65\text{ V}$.
- Tần số cắt lọc thông cao:
  $$f_{c,HPF} = \frac{1}{2\pi R_1 C_1} = \frac{1}{2\pi \times 8200 \times 1.0 \times 10^{-6}} \approx 19.41\text{ Hz}$$
- Mạch khuếch đại không đảo có mạng hồi tiếp:
  - Điện trở hồi tiếp ngõ ra về ngõ vào đảo: $R_{f1} = 100\text{ k}\Omega$ (1%).
  - Điện trở từ ngõ vào đảo về $V_{MID}$: $R_{g1} = 1.2\text{ k}\Omega$ (1%).
  - Tụ chặn DC nối tiếp với $R_{g1}$: $C_{g1} = 10\ \mu\text{F}$ (đảm bảo hệ số khuếch đại DC của riêng op-amp bằng 1, giữ điện thế tĩnh ngõ ra bám sát $V_{MID}$).
  - Hệ số khuếch đại AC tầng 2:
    $$G_2 = 1 + \frac{R_{f1}}{R_{g1}} = 1 + \frac{100\text{ k}\Omega}{1.2\text{ k}\Omega} = 1 + 83.33 = 84.33\times$$

### 3.4. Tầng 3: Lọc thông thấp Sallen-Key bậc 2 (Anti-Aliasing Filter)
Tần số lấy mẫu của ESP32-S3 là $f_s = 1000\text{ Hz}$, tần số Nyquist tương ứng là $f_{Nyquist} = 500\text{ Hz}$. Do đó, cần bộ lọc thông thấp với tần số cắt $f_c \approx 450\text{ Hz}$ để dập tắt hiện tượng răng cưa phổ tín hiệu.
- Cấu hình: Sallen-Key Low-Pass Filter bậc 2 hệ số khuếch đại bằng 1 ($K = 1$) để tối đa hóa độ ổn định.
- Hàm truyền chuẩn bậc 2:
  $$H(s) = \frac{1}{1 + s C_3 (R_2 + R_3) + s^2 R_2 R_3 C_2 C_3}$$
- Điều kiện đáp ứng Butterworth (độ phẳng tối đa trong dải thông, $Q = \frac{1}{\sqrt{2}} \approx 0.707$):
  Chọn $R_2 = R_3 = R$.
  $$f_c = \frac{1}{2\pi R \sqrt{C_2 C_3}}$$
  $$Q = \frac{1}{2}\sqrt{\frac{C_2}{C_3}} = 0.707 \implies \frac{C_2}{C_3} = 2$$
- Lựa chọn linh kiện chuẩn:
  Chọn $C_3 = 22\text{ nF}$ và $C_2 = 47\text{ nF}$ (tỷ lệ $C_2 / C_3 = 47 / 22 \approx 2.14$, cho $Q \approx 0.73$, rất gần giá trị chuẩn $0.707$ với độ gợn đỉnh dải thông dưới $0.1\text{ dB}$).
  $$\sqrt{C_2 C_3} = \sqrt{47 \times 22} \times 10^{-9} \approx 32.15\text{ nF}$$
  Tính điện trở $R$:
  $$R = \frac{1}{2\pi \times f_c \times \sqrt{C_2 C_3}} = \frac{1}{2\pi \times 450 \times 32.15 \times 10^{-9}} \approx 11.00\text{ k}\Omega$$
  Chọn giá trị chuẩn E96: $R_2 = R_3 = 11.0\text{ k}\Omega$ (1%).
- Tần số cắt thực tế đạt được:
  $$f_{c,LPF} = \frac{1}{2\pi \times 11000 \times 32.15 \times 10^{-9}} = 449.8\text{ Hz} \approx 450\text{ Hz}$$
- Hệ số khuếch đại tầng 3: $G_3 = 1.0\times$.

### 3.5. Tổng hệ số khuếch đại và kiểm chứng dải động
- Tổng Gain chuỗi tương tự:
  $$G_{total} = G_1 \times G_2 \times G_3 = 10.09 \times 84.33 \times 1.0 = 850.9\times \approx 851\times$$
- Phân tích biên độ:
  - Tín hiệu cơ nghỉ (Rest): $V_{in} \approx 0\ \mu\text{V} \implies V_{out} = 1.65\text{ V}$.
  - Tín hiệu co cơ thông thường: $V_{in} = \pm 0.5\text{ mV} \implies V_{out} = 1.65\text{ V} \pm (0.5\text{ mV} \times 851) = 1.65\text{ V} \pm 0.425\text{ V} \rightarrow [1.225\text{ V} - 2.075\text{ V}]$.
  - Tín hiệu co cơ cực đại (MVC): $V_{in} = \pm 1.5\text{ mV} \implies V_{out} = 1.65\text{ V} \pm (1.5\text{ mV} \times 851) = 1.65\text{ V} \pm 1.276\text{ V} \rightarrow [0.374\text{ V} - 2.926\text{ V}]$.
- Kết luận: Toàn bộ dải biên độ nằm trong khoảng an toàn $0.37\text{ V} - 2.93\text{ V}$, cách nguồn $3.3\text{ V}$ và $0\text{ V}$ khoảng $370\text{ mV}$, tương thích hoàn toàn với dải tuyến tính của ADC ESP32-S3 cấu hình `ADC_ATTEN_DB_12`.

---

## 4. TẦNG PHỤ TRỢ (AUXILIARY BLOCKS)

### 4.1. Mạch tạo điện áp tham chiếu ảo ($V_{MID} = 1.65\text{ V}$)
Hệ thống sử dụng nguồn đơn $3.3\text{ V}$ từ pin. Mạch cần một mức điện áp $1.65\text{ V}$ ổn định đóng vai trò như điểm 0V ảo cho tín hiệu xoay chiều.
- Cầu phân áp: Hai điện trở có độ chính xác cao $R_{div1} = R_{div2} = 100\text{ k}\Omega$ (1%).
- Tụ lọc nhiễu phân áp: $C_{div1} = 10\ \mu\text{F}$ song song với $C_{div2} = 100\text{ nF}$ nối từ điểm giữa về AGND.
- Tầng đệm: 1 cổng của Op-amp MCP6002 (Unit A) đấu theo cấu hình điện thế lặp (Voltage Follower, Gain = 1).
- Ngõ ra $V_{MID}$ được chống tự kích và khử nhiễu bằng tụ $C_{mid\_out} = 10\ \mu\text{F} \parallel 100\text{ nF}$ nối về AGND.

### 4.2. Mạch khử nhiễu chủ động DRL (Driven Right Leg)
Nhiễu điện trường $50\text{ Hz}$ từ lưới điện cảm ứng lên cơ thể người có thể đạt vài volt. Mạch DRL trích xuất điện áp đồng pha từ cơ thể, khuếch đại đảo pha và đưa ngược trở lại cơ thể qua điện cực tham chiếu (đặt ở mỏm khuỷu tay gót - Olecranon) để dập tắt nhiễu.
- Trích điện áp đồng pha: Hai điện trở $R_{cm1} = R_{cm2} = 100\text{ k}\Omega$ (1%) nối từ hai ngõ vào $IN+$ và $IN-$ của INA333 gom lại tại điểm $V_{CM}$.
- Tầng khuếch đại vi sai đảo (dùng Op-amp MCP6002 Unit B):
  - Ngõ vào không đảo nối về $V_{MID} = 1.65\text{ V}$.
  - Ngõ vào đảo nhận tín hiệu $V_{CM}$ qua điện trở $R_{in,DRL} = 47\text{ k}\Omega$.
  - Mạng hồi tiếp song song gồm $R_{f,DRL} = 470\text{ k}\Omega$ và tụ tích phân $C_{f,DRL} = 1.5\text{ nF}$.
  - Hệ số khuếch đại dải tần thấp:
    $$A_{DRL} = -\frac{R_{f,DRL}}{R_{in,DRL}} = -\frac{470\text{ k}\Omega}{47\text{ k}\Omega} = -10\times$$
  - Điểm cực bù pha (Roll-off pole) nhằm đảm bảo ổn định vòng hồi tiếp:
    $$f_{pole} = \frac{1}{2\pi R_{f,DRL} C_{f,DRL}} = \frac{1}{2\pi \times 470000 \times 1.5 \times 10^{-9}} \approx 225.7\text{ Hz}$$
- Mạch bảo vệ an toàn người dùng:
  Ngõ ra DRL nối tiếp với điện trở $R_{limit} = 390\text{ k}\Omega$ (song song với $C_{limit} = 1.0\text{ nF}$) trước khi ra cọc điện cực tham chiếu RLD. Điện trở này giới hạn dòng điện sự cố rò rỉ dưới $3.3\text{ V} / 390\text{ k}\Omega \approx 8.5\ \mu\text{A}$, đáp ứng tiêu chuẩn an toàn y sinh IEC 60601-1 (dòng rò qua người $< 10\ \mu\text{A}$).

---

## 5. BẢNG PHÂN BỔ IC VÀ DANH MỤC LINH KIỆN (BOM)

### 5.1. Phân bổ cổng IC (Pinout Allocation)
- **IC1:** INA333AIDGKR (SOIC-8 hoặc VSSOP-8) - Kênh 1 In-Amp.
- **IC2:** INA333AIDGKR (SOIC-8 hoặc VSSOP-8) - Kênh 2 In-Amp.
- **IC3:** MCP6004-E/SL (SOIC-14, Quad Op-amp):
  - Op-amp 1 (Chân 1, 2, 3): Kênh 1, Tầng 2 (HPF + Gain 84.3x).
  - Op-amp 2 (Chân 5, 6, 7): Kênh 1, Tầng 3 (Sallen-Key LPF 450Hz).
  - Op-amp 3 (Chân 8, 9, 10): Kênh 2, Tầng 3 (Sallen-Key LPF 450Hz).
  - Op-amp 4 (Chân 12, 13, 14): Kênh 2, Tầng 2 (HPF + Gain 84.3x).
- **IC4:** MCP6002-E/SN (SOIC-8, Dual Op-amp):
  - Op-amp 1 (Chân 1, 2, 3): Tầng tạo áp ảo $V_{MID} = 1.65\text{ V}$.
  - Op-amp 2 (Chân 5, 6, 7): Tầng mạch DRL khử nhiễu chủ động.

### 5.2. Danh mục linh kiện chi tiết (Bill of Materials)

| Ký hiệu | Loại linh kiện | Thông số chi tiết | Đóng gói | Số lượng | Chức năng |
| :--- | :--- | :--- | :--- | :--- | :--- |
| IC1, IC2 | IC In-Amp | INA333AIDGKR (Low Power, Rail-to-Rail) | SOIC-8 / VSSOP-8 | 2 | Tầng tiền khuếch đại vi sai |
| IC3 | IC Quad Op-amp | MCP6004-E/SL (1MHz, Rail-to-Rail) | SOIC-14 | 1 | Lọc HPF, Gain 2 và LPF 2 kênh |
| IC4 | IC Dual Op-amp | MCP6002-E/SN (1MHz, Rail-to-Rail) | SOIC-8 | 1 | Tạo áp ảo $V_{MID}$ và mạch DRL |
| RG1, RG2 | Điện trở dán | $11.0\text{ k}\Omega$ $\pm 1\%$ (E96) | 0805 | 2 | Cài đặt Gain $10.1\times$ cho INA333 |
| Rin1 - Rin4 | Điện trở dán | $10.0\text{ k}\Omega$ $\pm 1\%$ | 0805 | 4 | Lọc RF/ESD ngõ vào |
| Rcm1 - Rcm4 | Điện trở dán | $100\text{ k}\Omega$ $\pm 1\%$ | 0805 | 4 | Trích áp đồng pha cho DRL |
| R1, R4 | Điện trở dán | $8.2\text{ k}\Omega$ $\pm 1\%$ | 0805 | 2 | Thiết lập $f_c \approx 19.4\text{ Hz}$ tầng HPF |
| Rf1, Rf2 | Điện trở dán | $100\text{ k}\Omega$ $\pm 1\%$ | 0805 | 2 | Hồi tiếp Gain tầng 2 |
| Rg1, Rg2 | Điện trở dán | $1.2\text{ k}\Omega$ $\pm 1\%$ | 0805 | 2 | Định Gain tầng 2 |
| R2, R3, R5, R6 | Điện trở dán | $11.0\text{ k}\Omega$ $\pm 1\%$ | 0805 | 4 | Điện trở lọc Sallen-Key 450Hz |
| Rdiv1, Rdiv2 | Điện trở dán | $100\text{ k}\Omega$ $\pm 1\%$ | 0805 | 2 | Cầu phân áp tạo $V_{MID}$ |
| Rin_drl | Điện trở dán | $47.0\text{ k}\Omega$ $\pm 1\%$ | 0805 | 1 | Ngõ vào DRL |
| Rf_drl | Điện trở dán | $470\text{ k}\Omega$ $\pm 1\%$ | 0805 | 1 | Hồi tiếp Gain DRL |
| Rlimit | Điện trở dán | $390\text{ k}\Omega$ $\pm 5\%$ | 0805 | 1 | Bảo vệ dòng rò an toàn DRL |
| Cdiff1, Cdiff2 | Tụ gốm dán | $4.7\text{ nF}$ $50\text{V}$ C0G/NP0 | 0805 | 2 | Lọc RF vi sai đầu vào |
| Ccm1 - Ccm4 | Tụ gốm dán | $470\text{ pF}$ $50\text{V}$ C0G/NP0 | 0805 | 4 | Lọc RF đồng pha đầu vào |
| C1, C4 | Tụ gốm dán | $1.0\ \mu\text{F}$ $16\text{V}$ X7R | 0805 | 2 | Tụ liên tầng HPF chặn DC |
| Cg1, Cg2 | Tụ gốm dán | $10\ \mu\text{F}$ $10\text{V}$ X7R | 0805 | 2 | Tụ chặn DC hồi tiếp tầng 2 |
| C2, C5 | Tụ gốm dán | $47\text{ nF}$ $25\text{V}$ X7R | 0805 | 2 | Tụ Sallen-Key $C_2$ ($450\text{ Hz}$) |
| C3, C6 | Tụ gốm dán | $22\text{ nF}$ $25\text{V}$ X7R | 0805 | 2 | Tụ Sallen-Key $C_3$ ($450\text{ Hz}$) |
| Cf_drl | Tụ gốm dán | $1.5\text{ nF}$ $50\text{V}$ C0G/NP0 | 0805 | 1 | Bù pha vòng lặp DRL |
| Climit | Tụ gốm dán | $1.0\text{ nF}$ $50\text{V}$ C0G | 0805 | 1 | Tụ song song bảo vệ DRL |
| Cdiv1, Cmid1 | Tụ gốm dán | $10\ \mu\text{F}$ $10\text{V}$ X7R | 0805 | 2 | Ổn định đường áp $V_{MID}$ |
| Cdec1 - Cdec6 | Tụ gốm dán | $100\text{ nF}$ $16\text{V}$ X7R | 0805 | 6 | Tụ thoát nhiễu nguồn từng IC |
| J1, J2 | Jack âm thanh | Jack 3.5mm PJ-320D (hoặc header 3-pin) | Through-hole | 2 | Cổng cắm điện cực Kênh 1, 2 |
| J_OUT | Header cắm | Header đực 2.54mm 5-pin | Through-hole | 1 | Chân ra: 3.3V, GND, CH1, CH2, VMID |

---

## 6. NGUYÊN TẮC BỐ TRÍ MẶT BẰNG MẠCH IN (PCB LAYOUT GUIDELINES)

1. **Phân vùng tín hiệu (Ground Partitioning):**
   - Phủ mass toàn bộ lớp dưới (Bottom Layer) thành mặt phẳng đất tương tự (AGND Plane).
   - Không đi các đường tín hiệu số tốc độ cao hoặc xung nhịp SPI/I2C cắt ngang qua mặt dưới của khối INA333.
   - Nối đất tương tự (AGND) với đất số của ESP32 (DGND) tại một điểm duy nhất (Star Ground) ngay tại chân cắm nguồn đầu vào.

2. **Bảo vệ đường vi sai (Differential Guarding):**
   - Hai đường tín hiệu ngõ vào ($IN+$ và $IN-$) từ jack 3.5mm đến chân INA333 phải đi song song sát nhau với chiều dài bằng nhau để bảo toàn tỷ số triệt nhiễu đồng pha (CMRR).
   - Thiết kế vòng bảo vệ (Guard Ring) bao quanh các chân ngõ vào số 2 và 3 của INA333, nối vòng này về điện áp $V_{MID}$ để triệt tiêu dòng rò bề mặt PCB.

3. **Bố trí tụ thoát nguồn (Decoupling):**
   - Đặt mỗi tụ $100\text{ nF}$ sát từng chân $V_{DD}$ của INA333, MCP6004 và MCP6002 với khoảng cách dưới $2\text{ mm}$, nối trực tiếp xuống mặt phẳng AGND qua lỗ via ngắn.

4. **Cách ly khối vô tuyến Wi-Fi:**
   - Bo mạch AFE tương tự nên được bố trí cách xa khu vực ăng-ten PCB của ESP32-S3 tối thiểu $30\text{ mm}$ để ngăn trường bức xạ RF thâm nhập vào tầng khuếch đại độ nhạy cao.
