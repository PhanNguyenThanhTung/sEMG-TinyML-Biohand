#!/home/trithuc/Projects/sEMG-TinyML-Biohand/model_tinyml/venv/bin/python3
"""
Pipeline Huấn Luyện TinyML Đa Năng Cho Tín Hiệu sEMG (Universal sEMG TinyML Pipeline)
Tác giả: Hỗ trợ dự án sEMG ESP32-S3 (DTYS)

Ưu điểm nổi bật:
- Tự động cân bằng dữ liệu (Balanced Sampling) để tránh hiện tượng lớp 0 (Nghỉ) áp đảo các cử chỉ khác.
- Tùy biến mọi tham số qua dòng lệnh CLI: đường dẫn CSV, kênh đo, danh sách cử chỉ, số cây, độ sâu.
- Phân đoạn cửa sổ trượt (Sliding Window) và tính 4 đặc trưng chuẩn [RMS, MAV, WL, ZC].
- Chuẩn hóa Z-Score thích ứng mọi loại thang đo ADC.
- Đánh giá 80% Train / 20% Test (Stratified) + Ma trận nhầm lẫn (Confusion Matrix).
- Xuất mã C TinyML (.h) sẵn sàng nạp thẳng vào ESP32-S3.
"""

import os
import sys
import argparse
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.preprocessing import StandardScaler
import emlearn

PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.realpath(__file__)), ".."))
OUTPUT_DIR = os.path.join(PROJECT_DIR, "models")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def compute_window_features(window):
    """
    Trích xuất 4 đặc trưng thời gian cho 1 đoạn cửa sổ tín hiệu:
    - RMS: Root Mean Square (Công suất co cơ)
    - MAV: Mean Absolute Value (Biên độ trung bình tuyệt đối)
    - WL:  Waveform Length (Tổng chiều dài sóng nhấp nhô)
    - ZC:  Zero Crossing (Số lần cắt qua 0)
    """
    rms = np.sqrt(np.mean(window ** 2))
    mav = np.mean(np.abs(window))
    wl = np.sum(np.abs(np.diff(window)))
    zc = np.sum(((window[:-1] * window[1:]) < 0) & (np.abs(np.diff(window)) > 1e-5))
    return [rms, mav, wl, zc]

def process_raw_timeseries(df, channel_cols, label_col, selected_classes, window_size=200, step_size=50, max_windows_per_class=600):
    """
    Xử lý chuỗi thời gian thô với cơ chế Cân Bằng Mẫu (Balanced Windows)
    """
    print(f"\n[Xử lý] Dữ liệu Sóng thô thời gian thực:")
    print(f"  - Các kênh được chọn: {channel_cols}")
    print(f"  - Cột nhãn: '{label_col}' | Các lớp cử chỉ: {selected_classes}")
    print(f"  - Cửa sổ trượt: Window={window_size} mẫu, Step={step_size} mẫu")

    # Lọc chỉ lấy các lớp được chọn
    if selected_classes is not None and len(selected_classes) > 0:
        df = df[df[label_col].isin(selected_classes)].copy()

    class_windows = {cls: [] for cls in selected_classes}
    raw_signals = df[channel_cols].values
    labels = df[label_col].values
    num_samples = len(df)

    # Duyệt sliding window
    for start in range(0, num_samples - window_size, step_size):
        win_labels = labels[start : start + window_size]
        # Nếu cả cửa sổ cùng 1 nhãn
        if win_labels[0] == win_labels[-1]:
            cls = win_labels[0]
            if len(class_windows[cls]) < max_windows_per_class:
                feature_vector = []
                for ch_idx in range(len(channel_cols)):
                    ch_window = raw_signals[start : start + window_size, ch_idx]
                    feature_vector.extend(compute_window_features(ch_window))
                class_windows[cls].append(feature_vector)

    X_features = []
    y_labels = []
    print("  - Thống kê số lượng khung cửa sổ thu được:")
    for cls in selected_classes:
        n_win = len(class_windows[cls])
        print(f"    * Lớp {cls}: {n_win} khung cửa sổ")
        for feat in class_windows[cls]:
            X_features.append(feat)
            y_labels.append(cls)

    return np.array(X_features), np.array(y_labels)

def train_and_export(X, y, output_header_name, test_size=0.20, n_trees=15, max_depth=7):
    print("\n------------------------------------------------------------------")
    print(f"🚀 BẮT ĐẦU HUẤN LUYỆN TINYML (Tỷ lệ: {int((1-test_size)*100)}% Train - {int(test_size*100)}% Test)")
    print("------------------------------------------------------------------")
    print(f"-> Tổng số vector đặc trưng: {len(X)}")
    print(f"-> Số chiều đặc trưng đầu vào (Input nodes): {X.shape[1]}")

    unique_classes, counts = np.unique(y, return_counts=True)

    # Phân chia 80/20 Stratified
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y
    )
    print(f"-> Số mẫu Train (80%): {len(X_train)} | Số mẫu Test (20%): {len(X_test)}")

    # Chuẩn hóa Z-Score
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Huấn luyện Random Forest
    print(f"\n[Huấn luyện] Random Forest Classifier ({n_trees} cây, độ sâu max {max_depth})...")
    clf = RandomForestClassifier(n_estimators=n_trees, max_depth=max_depth, random_state=42)
    clf.fit(X_train_scaled, y_train)

    # Đánh giá trên tập Test
    y_pred = clf.predict(X_test_scaled)
    acc = accuracy_score(y_test, y_pred)
    print("------------------------------------------------------------------")
    print(f"🎯 ĐỘ CHÍNH XÁC KIỂM THỬ (TEST ACCURACY 80/20): {acc * 100:.2f}%")
    print("------------------------------------------------------------------\n")

    print("Báo cáo phân loại chi tiết (Classification Report):")
    print(classification_report(y_test, y_pred))

    print("Ma trận nhầm lẫn (Confusion Matrix):")
    cm = confusion_matrix(y_test, y_pred, labels=unique_classes)
    cm_df = pd.DataFrame(cm, index=[f"Thực: {c}" for c in unique_classes], columns=[f"Đoán: {c}" for c in unique_classes])
    print(cm_df)

    # Xuất mã C TinyML
    header_path = os.path.join(OUTPUT_DIR, output_header_name)
    print(f"\n[Xuất mã C TinyML] Đang chuyển đổi sang file C Header: {header_path}...")
    c_model = emlearn.convert(clf, method='inline')
    c_model.save(file=header_path, name='semg_gesture_model')

    print(f"✅ XUẤT MÔ HÌNH THÀNH CÔNG! Dung lượng file C: {os.path.getsize(header_path)} bytes")
    print(f"Vị trí lưu: {header_path}")
    print("==================================================================")

def main():
    parser = argparse.ArgumentParser(description="Pipeline Huấn Luyện TinyML Đa Năng Cho Mọi Dataset sEMG")
    parser.add_argument("--csv", type=str, default=os.path.join(PROJECT_DIR, "dataset", "EMG-data.csv"),
                        help="Đường dẫn tới file dataset CSV")
    parser.add_argument("--channels", nargs="+", default=["channel1", "channel5"],
                        help="Tên các cột kênh tín hiệu muốn dùng (Ví dụ: channel1 channel5)")
    parser.add_argument("--label_col", type=str, default="class",
                        help="Tên cột chứa nhãn cử chỉ (Ví dụ: class, Gesture, label)")
    parser.add_argument("--classes", nargs="+", type=int, default=[0, 1, 6],
                        help="Danh sách các lớp cử chỉ muốn học (Mặc định: 0=Nghỉ, 1=Nắm, 6=Xòe)")
    parser.add_argument("--nrows", type=int, default=500000,
                        help="Số dòng muốn nạp từ CSV")
    parser.add_argument("--window", type=int, default=200,
                        help="Độ dài cửa sổ trượt (mẫu)")
    parser.add_argument("--step", type=int, default=50,
                        help="Bước trượt của cửa sổ (mẫu)")
    parser.add_argument("--output", type=str, default="semg_model_universal.h",
                        help="Tên file C Header xuất ra trong thư mục models/")

    args = parser.parse_args()

    print("==================================================================")
    print("📂 UNIVERSAL TINYML sEMG TRAINING PIPELINE")
    print("==================================================================")
    print(f"File CSV đầu vào : {args.csv}")

    if not os.path.exists(args.csv):
        print(f"❌ LỖI: Không tìm thấy file {args.csv}!")
        sys.exit(1)

    print(f"Đang nạp dữ liệu (tối đa {args.nrows} dòng)...")
    df = pd.read_csv(args.csv, nrows=args.nrows)
    print(f"-> Đã nạp thành công {len(df)} dòng dữ liệu.")

    # Tự động nhận diện kiểu dữ liệu
    col_str = "".join(df.columns)
    if "RMS" in col_str or "AVG" in col_str or "STD" in col_str:
        feature_cols = [c for c in df.columns if c != args.label_col and c != "Iteration"]
        X = df[feature_cols].values
        y = df[args.label_col].values
    else:
        X, y = process_raw_timeseries(
            df, 
            channel_cols=args.channels, 
            label_col=args.label_col, 
            selected_classes=args.classes,
            window_size=args.window,
            step_size=args.step
        )

    if len(X) == 0:
        print("❌ LỖI: Không trích xuất được vector đặc trưng nào!")
        sys.exit(1)

    # Chạy Train 80/20 & Xuất C Header
    train_and_export(X, y, output_header_name=args.output, test_size=0.20)

if __name__ == "__main__":
    main()
