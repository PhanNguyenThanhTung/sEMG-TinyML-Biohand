"""
Module Tiền xử lý tín hiệu sEMG (DSP - Digital Signal Processing).
Bao gồm:
1. Bộ lọc Notch (Bandstop) 50Hz: Khử sóng hài từ điện lưới dân dụng 220V/50Hz.
2. Bộ lọc Dải thông (Bandpass) 20Hz - 450Hz: Giữ đúng dải tần điện sinh học cơ bắp,
   loại bỏ nhiễu trôi nền (baseline drift, chuyển động cơ học) và nhiễu nhiệt cao tần.
3. Cửa sổ trượt (Sliding Window): Cắt dòng tín hiệu liên tục thành các frame ngắn
   để trích xuất đặc trưng liên tục phục vụ suy luận thời gian thực (Real-time).
"""

import numpy as np
from scipy.signal import iirnotch, butter, filtfilt

class SEMGPreprocessor:
    def __init__(self, sampling_rate=1000, notch_freq=50.0, quality_factor=30.0,
                 lowcut=20.0, highcut=450.0, order=4):
        """
        Khởi tạo các thông số tiền xử lý:
        :param sampling_rate: Tần số lấy mẫu của ESP32 ADC (mặc định 1000 Hz)
        :param notch_freq: Tần số điện lưới cần khử (50 Hz tại VN)
        :param lowcut: Tần số cắt dưới (20 Hz loại bỏ baseline drift)
        :param highcut: Tần số cắt trên (450 Hz loại bỏ nhiễu cao tần)
        :param order: Bậc của bộ lọc Butterworth
        """
        self.fs = sampling_rate
        
        # Thiết kế bộ lọc Notch 50Hz
        self.b_notch, self.a_notch = iirnotch(notch_freq, quality_factor, fs=self.fs)
        
        # Thiết kế bộ lọc Bandpass Butterworth 20Hz - 450Hz
        nyquist = 0.5 * self.fs
        low = lowcut / nyquist
        high = min(highcut / nyquist, 0.99) # Giữ dưới tần số Nyquist
        self.b_band, self.a_band = butter(order, [low, high], btype='bandpass')

    def apply_filters(self, raw_signal):
        """
        Chuỗi lọc tín hiệu:
        1. Lọc Notch 50Hz
        2. Lọc Bandpass 20 - 450Hz
        3. Khử thành phần một chiều DC offset (trừ giá trị trung bình)
        """
        # Trừ mean để đưa tín hiệu về trục 0 (khử DC bias của cảm biến)
        sig_centered = raw_signal - np.mean(raw_signal)
        
        # Áp dụng bộ lọc Notch 50Hz
        sig_notch = filtfilt(self.b_notch, self.a_notch, sig_centered)
        
        # Áp dụng bộ lọc Bandpass 20Hz - 450Hz
        sig_filtered = filtfilt(self.b_band, self.a_band, sig_notch)
        
        return sig_filtered

    def segment_sliding_window(self, signal, window_size_ms=200, step_size_ms=50):
        """
        Phân đoạn tín hiệu liên tục bằng cửa sổ trượt (Sliding Window):
        :param window_size_ms: Độ dài cửa sổ (mặc định 200ms)
        :param step_size_ms: Bước trượt (mặc định 50ms - overlap 75%)
        :return: Mảng các khung cửa sổ tín hiệu
        """
        win_len = int((window_size_ms / 1000.0) * self.fs)
        step_len = int((step_size_ms / 1000.0) * self.fs)
        
        num_samples = len(signal)
        windows = []
        
        start = 0
        while start + win_len <= num_samples:
            window = signal[start : start + win_len]
            windows.append(window)
            start += step_len
            
        return np.array(windows)
