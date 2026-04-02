# 📟 MMHCS Python Client - Ứng dụng Desktop Passkey

Ứng dụng Desktop client được viết bằng Python (PyQt6), chuyên dụng để thực hiện các thao tác xác thực Passkey (FIDO2/WebAuthn), quản lý danh tính bảo mật và tương tác với hệ thống backend Chatify qua mạng LAN.

## 🌟 Các tính năng chính

- **Xác thực FIDO2/WebAuthn**: Hỗ trợ đăng nhập và đăng ký không mật khẩu sử dụng vân tay (Windows Hello) hoặc khóa bảo mật USB (Yubikey).
- **Giao diện PyQt6**: Giao diện người dùng desktop hiện đại, trực quan cho các tác vụ quản lý bảo mật.
- **Tương tác LAN**: Tự động nhận diện IP mạng LAN để kết nối tới máy chủ backend.
- **Lưu trữ bảo mật**: Quản lý các chứng chỉ (Credentials) cục bộ an toàn.

## 🛠️ Cài đặt

### Yêu cầu hệ thống
- Python 3.9 trở lên.
- Windows 10/11 (hỗ trợ Windows Hello) hoặc thiết bị FIDO2 USB trên Linux/macOS.

### Các bước cài đặt

1. Di chuyển vào thư mục:
   ```bash
   cd mmhcs-python
   ```

2. Tạo môi trường ảo (Khuyên dùng):
   ```bash
   python -m venv .venv
   .\.venv\Scripts\activate  # Windows
   source .venv/bin/activate # Linux/macOS
   ```

3. Cài đặt các thư viện phụ thuộc:
   ```bash
   pip install -r requirements.txt
   ```

4. Cấu hình biến môi trường:
   Sao chép `.env.example` thành `.env` và cập nhật các giá trị phù hợp:
   ```bash
   cp .env.example .env
   ```
   *Lưu ý: Đảm bảo `CHATIFY_BACKEND_URL` trỏ đúng vào địa chỉ IP của server backend.*

## 🚀 Khởi chạy

Để mở giao diện đăng nhập Desktop:
```bash
python login_ui.py
```

## 📁 Cấu trúc file quan trọng

- `login_ui.py`: Điểm khởi đầu của ứng dụng (Main UI).
- `passkey_client.py`: Wrapper xử lý logic FIDO2/WebAuthn (Windows Hello/HID Device).
- `passkey_server.py`: Chứa các logic liên lạc với API Backend để thực hiện Challenge/Response.
- `credential_store.py`: Quản lý việc lưu trữ và truy vấn danh tính người dùng cục bộ.
