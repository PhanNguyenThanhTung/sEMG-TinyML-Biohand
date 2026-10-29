#!/usr/bin/env bash
# Script khởi chạy nhanh UI 3D Biohand Simulator

# Chuyển về đúng thư mục chứa script
cd "$(dirname "$0")"

PORT=8000
echo "🚀 Đang khởi động sEMG Biohand 3D Simulator tại http://localhost:$PORT ..."
echo "👉 Nhấn Ctrl + C để dừng."

# Mở trình duyệt mặc định nếu có xdg-open
if command -v xdg-open &> /dev/null; then
    (sleep 1 && xdg-open "http://localhost:$PORT") &
fi

python3 server.py $PORT
