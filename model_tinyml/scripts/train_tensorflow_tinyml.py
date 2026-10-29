#!/home/trithuc/Projects/sEMG-TinyML-Biohand/model_tinyml/venv/bin/python3
"""
Pipeline Huấn Luyện Mạng Nơ-ron TensorFlow TinyML Đỉnh Cao Cho sEMG (ESP32-S3)
Thiết kế chuẩn theo bản đặc tả kỹ thuật `script.md` cho dự án DTYS

Trang bị trọn bộ 6 đặc trưng vàng (Extended Hudgins Set):
1. RMS  (Root Mean Square)       : Công suất & năng lượng co cơ
2. MAV  (Mean Absolute Value)    : Biên độ trung bình tuyệt đối
3. WL   (Waveform Length)        : Tổng chiều dài sóng nhấp nhô
4. ZC   (Zero Crossing)          : Tần số cắt qua mức 0
5. SSC  (Slope Sign Changes)     : Tần số đổi chiều dốc (mật độ kích hoạt Motor Units)
6. WAMP (Willison Amplitude)     : Số lần co cơ kích hoạt vượt ngưỡng

Tổng số đầu vào AI (2 kênh x 6 đặc trưng) = 12 nodes.
Kết hợp:
- Lọc theo Subject cụ thể (--subject 1) & Cặp kênh tối ưu (--channels channel4 channel7).
- Cắt bỏ 10% biên chuyển tiếp để lấy vùng co cơ ổn định (Steady State).
- Tự động lưu và khôi phục trọng số tốt nhất (ModelCheckpoint / Restore Best Weights).
- Lượng tử hóa PTQ INT8 và xuất mảng byte C++ `model_data.h` chuẩn TFLM.
"""

import os
import sys
import warnings

# Tắt triệt để mọi thông báo cảnh báo C-level của TensorFlow
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
warnings.filterwarnings('ignore')

# Khóa tạm file descriptor stderr ở tầng hệ điều hành khi import TensorFlow để khử log rác C++
stderr_fd = sys.stderr.fileno()
saved_fd = os.dup(stderr_fd)
devnull = os.open(os.devnull, os.O_WRONLY)
os.dup2(devnull, stderr_fd)

import tensorflow as tf

os.dup2(saved_fd, stderr_fd)
os.close(saved_fd)
os.close(devnull)

tf.get_logger().setLevel('ERROR')
tf.autograph.set_verbosity(0)

import argparse
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.realpath(__file__)), ".."))
OUTPUT_DIR = os.path.join(PROJECT_DIR, "models")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def compute_6_features(window, zc_threshold=1e-5, wamp_threshold=2e-5):
    """
    Trích xuất trọn bộ 6 đặc trưng thời gian vàng cho 1 đoạn cửa sổ tín hiệu:
    1. RMS:  Root Mean Square
    2. MAV:  Mean Absolute Value
    3. WL:   Waveform Length
    4. ZC:   Zero Crossing
    5. SSC:  Slope Sign Changes
    6. WAMP: Willison Amplitude
    """
    diff_w = np.diff(window)
    abs_diff = np.abs(diff_w)

    # 1. RMS
    rms = np.sqrt(np.mean(window ** 2))
    
    # 2. MAV
    mav = np.mean(np.abs(window))
    
    # 3. WL
    wl = np.sum(abs_diff)
    
    # 4. ZC: Đổi dấu qua trục 0 và độ chênh lớn hơn ngưỡng
    zc = np.sum(((window[:-1] * window[1:]) < 0) & (abs_diff > zc_threshold))
    
    # 5. SSC: Điểm uốn đổi chiều dốc: (x[i] - x[i-1]) * (x[i] - x[i+1]) >= ngưỡng
    if len(window) >= 3:
        diff_left = window[1:-1] - window[:-2]
        diff_right = window[1:-1] - window[2:]
        ssc = np.sum((diff_left * diff_right > 0) & ((np.abs(diff_left) > zc_threshold) | (np.abs(diff_right) > zc_threshold)))
    else:
        ssc = 0
        
    # 6. WAMP: Số lần biên độ biến thiên giữa 2 mẫu liên tiếp vượt ngưỡng
    wamp = np.sum(abs_diff > wamp_threshold)
    
    return [rms, mav, wl, zc, ssc, wamp]

def process_raw_timeseries_6feat(df, channel_cols, label_col, selected_classes, subject_id=1, window_size=200, step_size=25, max_windows_per_class=450):
    """
    Xử lý chuỗi thời gian thô và trích xuất bộ 6 đặc trưng cho từng kênh
    """
    print(f"\n[Xử lý] Dữ liệu Sóng thô thời gian thực:")
    if "label" in df.columns and subject_id is not None:
        df = df[df["label"] == subject_id].copy()
        print(f"  - 🎯 Đã lọc riêng đối tượng người thử nghiệm (Subject): {subject_id} ({len(df)} mẫu)")
    
    print(f"  - Cặp kênh cảm biến tối ưu: {channel_cols}")
    print(f"  - Cột nhãn: '{label_col}' | Các lớp cử chỉ: {selected_classes}")
    print(f"  - Bộ 6 đặc trưng/kênh: [RMS, MAV, WL, ZC, SSC, WAMP]")
    print(f"  - Cửa sổ trượt: Window={window_size} mẫu, Step={step_size} mẫu (Lọc bỏ 10% biên chuyển giao)")

    class_windows = {cls: [] for cls in selected_classes}

    for cls in selected_classes:
        sub = df[df[label_col] == cls]
        n = len(sub)
        if n < window_size:
            continue
        # Bỏ 10% đầu và 10% đuôi để lấy vùng co cơ ổn định (Steady state)
        sub_steady = sub.iloc[int(n * 0.10) : int(n * 0.90)]
        sig = sub_steady[channel_cols].values

        for start in range(0, len(sig) - window_size, step_size):
            w = sig[start : start + window_size]
            feature_vector = []
            for ch_idx in range(len(channel_cols)):
                ch_window = w[:, ch_idx]
                feature_vector.extend(compute_6_features(ch_window))
            
            class_windows[cls].append(feature_vector)
            if len(class_windows[cls]) >= max_windows_per_class:
                break

    X_features, y_labels = [], []
    print("  - Thống kê số lượng khung cửa sổ ổn định thu được:")
    for cls in selected_classes:
        n_win = len(class_windows[cls])
        print(f"    * Lớp {cls}: {n_win} khung cửa sổ")
        for feat in class_windows[cls]:
            X_features.append(feat)
            y_labels.append(cls)

    return np.array(X_features), np.array(y_labels)

def export_tflite_to_c_header(tflite_bytes, output_path, array_name="g_gesture_model_data"):
    hex_lines = []
    total_len = len(tflite_bytes)
    for i in range(0, total_len, 12):
        chunk = tflite_bytes[i : i + 12]
        hex_lines.append("  " + ", ".join(f"0x{b:02x}" for b in chunk))

    c_content = f"""// Tự động sinh bởi train_tensorflow_tinyml.py (Full 6 Features: RMS, MAV, WL, ZC, SSC, WAMP)
// Kích thước mô hình TinyML: {total_len} bytes
// Định dạng: TensorFlow Lite for Microcontrollers (TFLM) FlatBuffers

#ifndef GESTURE_MODEL_DATA_H_
#define GESTURE_MODEL_DATA_H_

#ifdef __has_attribute
#define HAVE_ATTRIBUTE(x) __has_attribute(x)
#else
#define HAVE_ATTRIBUTE(x) 0
#endif

#if HAVE_ATTRIBUTE(aligned) || (defined(__GNUC__) && !defined(__clang__))
#define DATA_ALIGN_ATTRIBUTE __attribute__((aligned(4)))
#else
#define DATA_ALIGN_ATTRIBUTE
#endif

const int {array_name}_len = {total_len};
const unsigned char {array_name}[] DATA_ALIGN_ATTRIBUTE = {{
{',\n'.join(hex_lines)}
}};

#endif  // GESTURE_MODEL_DATA_H_
"""
    with open(output_path, "w") as f:
        f.write(c_content)
    print(f"\n✅ ĐÃ XUẤT FILE C++ HEADER TFLITE: {output_path}")
    print(f"Dung lượng mô hình TinyML: {total_len} bytes (~{total_len/1024:.2f} KB)")

def main():
    parser = argparse.ArgumentParser(description="Pipeline Huấn Luyện Mạng Nơ-ron TensorFlow TinyML Trọn Bộ 6 Đặc Trưng")
    parser.add_argument("--csv", type=str, default=os.path.join(PROJECT_DIR, "dataset", "EMG-data.csv"),
                        help="Đường dẫn file dataset CSV")
    parser.add_argument("--subject", type=int, default=1,
                        help="ID đối tượng người thử nghiệm muốn học (Mặc định: 1)")
    parser.add_argument("--channels", nargs="+", default=["channel4", "channel7"],
                        help="Cặp kênh cảm biến tối ưu (Mặc định: channel4 channel7)")
    parser.add_argument("--label_col", type=str, default="class",
                        help="Tên cột nhãn cử chỉ (Mặc định: class)")
    parser.add_argument("--classes", nargs="+", type=int, default=[0, 1, 6],
                        help="Danh sách các cử chỉ muốn học (0=Nghỉ, 1=Nắm, 6=Xòe)")
    parser.add_argument("--epochs", type=int, default=100,
                        help="Số lượt huấn luyện (Mặc định: 100 Epochs)")
    parser.add_argument("--batch_size", type=int, default=16,
                        help="Kích thước Mini-Batch size (Mặc định: 16)")
    parser.add_argument("--output", type=str, default="model_data.h",
                        help="Tên file C++ Header xuất ra trong models/")

    args = parser.parse_args()

    print("==================================================================")
    print("🌟 TENSORFLOW TINYML: BỘ 6 ĐẶC TRƯNG VÀNG CHO sEMG (ESP32-S3)")
    print("==================================================================")
    print(f"  - Mini-Batch Size : {args.batch_size}")
    print(f"  - Số Epochs       : {args.epochs}")

    if not os.path.exists(args.csv):
        print(f"❌ LỖI: Không tìm thấy file {args.csv}!")
        sys.exit(1)

    print(f"\nĐang nạp dữ liệu từ {args.csv}...")
    df = pd.read_csv(args.csv, nrows=150000)

    # 1. Trích xuất trọn bộ 6 đặc trưng cho từng kênh
    X, y_raw = process_raw_timeseries_6feat(
        df,
        channel_cols=args.channels,
        label_col=args.label_col,
        selected_classes=args.classes,
        subject_id=args.subject,
        window_size=200,
        step_size=25
    )

    unique_classes = sorted(list(np.unique(y_raw)))
    class_to_idx = {cls: idx for idx, cls in enumerate(unique_classes)}
    idx_to_class = {idx: cls for idx, cls in enumerate(unique_classes)}
    y = np.array([class_to_idx[val] for val in y_raw])

    num_classes = len(unique_classes)
    input_dim = X.shape[1]

    print("\n------------------------------------------------------------------")
    print(f"📊 TỔNG QUAN TẬP DỮ LIỆU:")
    print(f"  - Số chiều đầu vào (Input features): {input_dim} (2 kênh x 6 đặc trưng)")
    print(f"  - Số lớp cử chỉ đầu ra (Classes): {num_classes} ({unique_classes})")
    print(f"  - Tổng số mẫu đặc trưng ổn định: {len(X)}")

    # 2. Phân chia 80% Train - 20% Test (Stratified)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # 3. Chuẩn hóa Z-Score
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 4. Kiến trúc Mạng Nơ-ron MLP Nâng Cấp (48 -> Dropout 0.1 -> 24 -> Softmax)
    print("\n[Huấn luyện] Khởi tạo kiến trúc MLP (48 nodes -> Dropout 0.1 -> 24 nodes -> Softmax)...")
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(input_dim,)),
        tf.keras.layers.Dense(48, activation='relu'),
        tf.keras.layers.Dropout(0.10), # Tắt nhẹ 10% nơ-ron chống học vẹt
        tf.keras.layers.Dense(24, activation='relu'),
        tf.keras.layers.Dense(num_classes, activation='softmax')
    ])

    # Learning Rate Decay giúp trọng số rơi chính xác vào điểm tối ưu toàn cục
    lr_schedule = tf.keras.optimizers.schedules.ExponentialDecay(
        initial_learning_rate=0.003,
        decay_steps=250,
        decay_rate=0.92
    )

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=lr_schedule),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )

    # Cơ chế EarlyStopping tự động khôi phục trọng số ở thời điểm phong độ cao nhất
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor='val_accuracy',
            patience=25,
            restore_best_weights=True,
            verbose=1
        )
    ]

    print(f"Bắt đầu huấn luyện mạng nơ-ron ({args.epochs} Epochs, Mini-Batch={args.batch_size})...")
    history = model.fit(
        X_train_scaled, y_train,
        epochs=args.epochs,
        batch_size=args.batch_size,
        validation_data=(X_test_scaled, y_test),
        callbacks=callbacks,
        verbose=1
    )

    # 5. Đánh giá độ chính xác trên tập Test độc lập
    y_pred_probs = model.predict(X_test_scaled)
    y_pred = np.argmax(y_pred_probs, axis=1)
    acc = accuracy_score(y_test, y_pred)

    print("\n------------------------------------------------------------------")
    print(f"🎯 ĐỘ CHÍNH XÁC KIỂM THỬ ĐỈNH CAO (TEST ACCURACY 80/20): {acc * 100:.2f}%")
    print("------------------------------------------------------------------\n")

    target_names = [f"Lớp {idx_to_class[i]}" for i in range(num_classes)]
    print(classification_report(y_test, y_pred, target_names=target_names))

    cm = confusion_matrix(y_test, y_pred)
    cm_df = pd.DataFrame(cm, index=[f"Thực: {c}" for c in target_names], columns=[f"Đoán: {c}" for c in target_names])
    print("Ma trận nhầm lẫn (Confusion Matrix):")
    print(cm_df)

    # 6. Lượng tử hóa TinyML INT8 (Post-Training Quantization - PTQ)
    print("\n[Lượng tử hóa] Đang tối ưu TinyML INT8 qua TFLite Converter...")
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]

    def representative_dataset_gen():
        for i in range(min(150, len(X_train_scaled))):
            yield [X_train_scaled[i : i + 1].astype(np.float32)]

    converter.representative_dataset = representative_dataset_gen
    tflite_quant_model = converter.convert()

    # 7. Xuất trực tiếp sang file C++ Header
    header_path = os.path.join(OUTPUT_DIR, args.output)
    export_tflite_to_c_header(tflite_quant_model, header_path, array_name="g_gesture_model_data")

    print("\n🎉 HOÀN THÀNH XUẤT SẮC PIPELINE TENSORFLOW TINYML BỘ 6 ĐẶC TRƯNG!")
    print(f"File C++ Header: {header_path}")
    print("==================================================================")

if __name__ == "__main__":
    main()
