# 🛡️ Backend - Máy chủ Trò chuyện Bảo mật E2EE (FastAPI)

Đây là máy chủ trung tâm (backend) phục vụ cho dự án Trò chuyện Bảo mật đa nền tảng. Hệ thống được viết bằng ngôn ngữ Python với framework FastAPI và cơ sở dữ liệu MongoDB nhằm đáp ứng hiệu năng cực cao và kiến trúc hoàn toàn bất đồng bộ (Async/Await).

Backend không giữ bất cứ khóa mã hóa để giải mã nội dung của người dùng. Hệ thống chỉ thực hiện chức năng trung chuyển gói tin E2EE, nhận diện Passkey và phân tán Public Keys để cho phép hệ thống làm việc trong mạng phân tán.

## 🌟 Các tính năng chính

- **Xác thực Passkeys (WebAuthn/FIDO2)**: Xử lý và kiểm tra danh tính thông qua các khóa sinh trắc học và quản lý Challenge/Relying Party (RP) cho kết nối nội bộ hoặc LAN.
- **Phân phối khóa E2EE**: Lưu trữ và cung cấp *Public Identity Key*, *Signed PreKey*, và *One-Time PreKeys* của người dùng, đóng vai trò như điểm trung gian thiết lập kết nối mã hóa trực tiếp (Signal Protocol).
- **Phục hồi & Sao lưu khóa**: Lưu trữ các file keys sao lưu đã được cấp mã hóa tại cơ sở dữ liệu nhằm giữ tính linh hoạt và ổn định khi người dùng thay đổi thiết bị hay tải nạp lại ứng dụng, chống mất Key phiên.
- **WebSocket Real-time**: Sử dụng engine python-socketio để trực tiếp trung chuyển tin nhắn mã hóa và cập nhật trạng thái thiết bị của người dùng (Online/Offline) trên mạng LAN.

## 🛠️ Công nghệ cốt lõi

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) chạy trên Python 3.9+
- **Cơ sở dữ liệu**: MongoDB qua driver `motor` thực hiện truy xuất bất đồng bộ.
- **Giao thức mạng**: python-socketio (cho hệ thống WebSocket)
- **Quản lý Package**: Package manager thế hệ mới `uv`.

## 🚀 Hướng dẫn cài đặt và sử dụng

### Yêu cầu tiên quyết
- Python >= 3.9
- MongoDB (Sử dụng Compass hoặc Server chạy tự do, cung cấp MongoDB URI)
- Có sẵn trình quản lý `uv`.

### Các bước cài đặt

1. Di chuyển vào thư mục backend:
   ```bash
   cd backend
   ```

2. Tạo và kích hoạt môi trường ảo sử dụng uv:
   ```bash
   uv venv
   
   # Kích hoạt trên nền Windows:
   .\.venv\Scripts\activate
   
   # Kích hoạt trên macOS/Linux:
   source .venv/bin/activate
   ```

3. Cài đặt các thư viện cần thiết:
   ```bash
   uv pip install -r requirements.txt
   ```

4. Cấu hình các biến môi trường:
   Tạo tệp `.env` định dạng từ `.env.example` và tùy chỉnh để phù hợp với đường truyền của bạn (Ví dụ: Chỉnh `MONGO_URI`, `CLIENT_URL` sao cho khớp với IP trong hệ thống LAN).
   ```bash
   cp .env.example .env
   ```

5. Khởi động server (Uvicorn HTTP Server):
   ```bash
   # Môi trường Development (Host 0.0.0.0 sẽ cho phép thiết bị khác trong mạng LAN có quyền kết nối)
   uv run uvicorn src.server:app --reload --host 0.0.0.0 --port 3000
   ```

## 🔐 Chi tiết Route phân cấp cơ bản
* `/api/auth`: Điều phối toàn bộ hoạt động cấp đăng ký, đăng nhập và xác minh bằng Passkeys theo định dạng giao tiếp FIDO2 bảo mật nghiêm ngặt bằng cookie.
* `/api/messages`: Thực hiện các endpoint gọi API liên quan tới gửi/nhận PreKey Bundle và giao tiếp gói tin Signal mã hóa.
