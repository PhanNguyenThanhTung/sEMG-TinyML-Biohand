import http.server
import socketserver
import sys
import os

# Luôn phục vụ file từ thư mục chứa file server.py
os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = 8000 if len(sys.argv) < 2 else int(sys.argv[1])

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Chống lưu cache để khi sửa code trình duyệt luôn nhận phiên bản mới nhất
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"🚀 UI Server đang chạy tại http://localhost:{PORT} (No-Cache Mode)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nĐã dừng server.")
