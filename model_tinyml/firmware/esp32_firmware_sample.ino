/*
 * ESP32-S3 Real-Time sEMG Gesture Recognition
 * --------------------------------------------
 * Ví dụ mã nguồn firmware mẫu chạy trên ESP32-S3 (Arduino IDE hoặc PlatformIO).
 * Nhận tín hiệu ADC từ cảm biến sEMG, tính đặc trưng và đưa vào mô hình TinyML.
 */

#include "gesture_model.h"

#define EMG_PIN 1          // Chân ADC nối cảm biến sEMG trên ESP32-S3
#define WINDOW_SIZE 200    // Cửa sổ 200 mẫu (200ms với tần số 1000Hz)

int16_t buffer[WINDOW_SIZE];
int buf_index = 0;

// Các hàm tính đặc trưng nhanh trên vi điều khiển
float compute_rms(int16_t *data, int len) {
    int64_t sum_sq = 0;
    for (int i = 0; i < len; i++) {
        sum_sq += (int32_t)data[i] * data[i];
    }
    return sqrt((float)sum_sq / len);
}

float compute_mav(int16_t *data, int len) {
    int64_t sum = 0;
    for (int i = 0; i < len; i++) {
        sum += abs(data[i]);
    }
    return (float)sum / len;
}

float compute_wl(int16_t *data, int len) {
    int64_t sum = 0;
    for (int i = 0; i < len - 1; i++) {
        sum += abs(data[i + 1] - data[i]);
    }
    return (float)sum;
}

void setup() {
    Serial.begin(115200);
    analogReadResolution(12); // ESP32-S3 ADC 12-bit (0 - 4095)
    Serial.println("ESP32-S3 TinyML Gesture Ready!");
}

void loop() {
    // 1. Đọc mẫu ADC (lấy mẫu mỗi 1ms ~ 1000Hz)
    int raw_val = analogRead(EMG_PIN);
    buffer[buf_index++] = raw_val - 2048; // Khử mức DC trung tâm

    // Khi đầy cửa sổ 200ms -> Suy luận (Inference)
    if (buf_index >= WINDOW_SIZE) {
        buf_index = 0; // Reset buffer (hoặc dịch buffer dạng circular)

        // 2. Trích xuất đặc trưng
        float rms = compute_rms(buffer, WINDOW_SIZE);
        float mav = compute_mav(buffer, WINDOW_SIZE);
        float wl  = compute_wl(buffer, WINDOW_SIZE);
        int16_t zc = 0; // Tùy chọn tính ZC

        int16_t features[4] = { (int16_t)rms, (int16_t)mav, (int16_t)wl, zc };

        // 3. Dự đoán cử chỉ bằng TinyML
        int gesture = gesture_model_predict(features, 4);

        // 4. In kết quả
        switch (gesture) {
            case 0: Serial.println("Cử chỉ: NGHỈ (Rest)"); break;
            case 1: Serial.println("Cử chỉ: NẮM TAY (Fist) ✊"); break;
            case 2: Serial.println("Cử chỉ: MỞ BÀN TAY (Open) 🖐"); break;
            case 3: Serial.println("Cử chỉ: CHỈ NGÓN (Point) ☝"); break;
        }
    }

    delayMicroseconds(1000); // 1000us = 1ms (1000Hz)
}
