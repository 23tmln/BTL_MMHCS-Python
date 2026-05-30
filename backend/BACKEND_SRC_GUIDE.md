# Hướng dẫn chi tiết mã nguồn Backend (src)

Tài liệu này giải thích chi tiết chức năng của từng thư mục và file trong mã nguồn backend của dự án **BTL_MMHCS-Python**.

---

## 1. Cấu trúc thư mục tổng quan

Thư mục `backend/src` được tổ chức theo mô hình **Controller-Route-Model**, giúp tách biệt logic nghiệp vụ, định tuyến API và cấu trúc dữ liệu.

- `controllers/`: Chứa logic xử lý của các API.
- `models/`: Chứa các định nghĩa cấu trúc dữ liệu (Pydantic models).
- `routes/`: Chứa định nghĩa các điểm cuối (endpoints) API.
- `lib/`: Chứa các thư viện hỗ trợ, cấu hình và kết nối dịch vụ bên thứ ba.
- `middleware/`: Chứa các lớp trung gian (ví dụ: kiểm tra đăng nhập).
- `server.py`: File khởi chạy ứng dụng chính.

---

## 2. Chi tiết từng File

### 📂 Root (`src/`)

#### 📄 [server.py](file:///c:/Users/ADMIN/BTL_MMHCS-Python/backend/src/server.py)
- **Chức năng**: Điểm khởi đầu của ứng dụng FastAPI.
- **Nội dung chính**:
  - Khởi tạo `FastAPI` instance.
  - Cấu hình Middleware (CORS) để cho phép Frontend kết nối.
  - Kết nối cơ sở dữ liệu MongoDB thông qua `lifespan`.
  - Tích hợp các Router (`auth`, `message`, `crypto`).
  - Gắn kết (mount) Socket.IO và thư mục `uploads` để phục vụ file tĩnh.

---

### 📂 Controllers (`src/controllers/`)

#### 📄 [auth_controller.py](file:///c:/Users/ADMIN/BTL_MMHCS-Python/backend/src/controllers/auth_controller.py)
- **Chức năng**: Xử lý logic liên quan đến tài khoản người dùng.
- **Các hàm chính**:
  - `signup`: Đăng ký người dùng mới, băm mật khẩu (bcrypt), tạo khóa mã hóa (E2EE), gửi email chào mừng.
  - `login`: Kiểm tra thông tin đăng nhập, tạo JWT token.
  - `logout`: Xử lý đăng xuất.
  - `update_profile`: Cập nhật ảnh đại diện (lưu trên Cloudinary) và tên người dùng.
  - `check_auth`: Kiểm tra trạng thái đăng nhập hiện tại.

#### 📄 [message_controller.py](file:///c:/Users/ADMIN/BTL_MMHCS-Python/backend/src/controllers/message_controller.py)
- **Chức năng**: Quản lý tin nhắn và danh sách liên hệ.
- **Các hàm chính**:
  - `get_all_contacts`: Lấy danh sách tất cả người dùng khác để bắt đầu chat.
  - `get_messages_by_user_id`: Lấy lịch sử tin nhắn giữa hai người dùng.
  - `send_message`: Lưu tin nhắn vào DB và gửi thông báo thời gian thực qua Socket.IO.
  - `get_chat_partners`: Lấy danh sách những người đã từng nhắn tin (sắp xếp theo thời gian mới nhất).

#### 📄 [secure_storage_controller.py](file:///c:/Users/ADMIN/BTL_MMHCS-Python/backend/src/controllers/secure_storage_controller.py)
- **Chức năng**: Lưu trữ an toàn các trạng thái mã hóa (E2EE) của người dùng.
- **Các hàm chính**:
  - `setup_secure_storage`: Thiết lập mã PIN để bảo vệ khóa bí mật.
  - `backup_secure_storage`: Sao lưu các khóa mã hóa đã được mã hóa bằng PIN lên Cloud.
  - `restore_secure_storage`: Khôi phục lại khóa mã hóa khi người dùng đăng nhập trên thiết bị mới.

---

### 📂 Models (`src/models/`)

Dùng **Pydantic** để kiểm tra tính hợp lệ của dữ liệu đầu vào và định nghĩa kiểu dữ liệu trả về cho API.

- 📄 **User.py**: Định nghĩa cấu trúc người dùng (Email, Tên, Mật khẩu, Ảnh đại diện).
- 📄 **Message.py**: Định nghĩa cấu trúc tin nhắn (Người gửi, Người nhận, Nội dung đã mã hóa, Loại tin nhắn, Session ID).
- 📄 **KeyBundle.py**: Định nghĩa cấu trúc bộ khóa công khai (Public Keys) dùng cho giao thức Signal (X3DH).
- 📄 **SecureStorage.py**: Định nghĩa cấu trúc dữ liệu sao lưu khóa an toàn.

---

### 📂 Routes (`src/routes/`)

Kết nối URL với các Controller tương ứng.

- 📄 **auth_route.py**: Các đường dẫn `/api/auth/signup`, `/login`, `/logout`, `/check`. Xử lý lưu JWT vào Cookie.
- 📄 **message_route.py**: Các đường dẫn `/api/messages/contacts`, `/chats`, `/send/{id}`, `/{id}`.
- 📄 **crypto_route.py**: Quản lý việc tải lên/tải về các bộ khóa công khai (`key_bundles`) và sao lưu khóa mã hóa.
- 📄 **secure_storage_route.py**: Các đường dẫn liên quan đến thiết lập/khôi phục Secure Storage bằng PIN.

---

### 📂 Library (`src/lib/`)

#### 📄 [db.py](file:///c:/Users/ADMIN/BTL_MMHCS-Python/backend/src/lib/db.py)
- Sử dụng `motor` (trình điều khiển async cho MongoDB) để quản lý kết nối cơ sở dữ liệu.

#### 📄 [socket.py](file:///c:/Users/ADMIN/BTL_MMHCS-Python/backend/src/lib/socket.py)
- Cấu hình `python-socketio` để hỗ trợ giao tiếp thời gian thực.
- Quản lý `user_socket_map` để biết người dùng nào đang trực tuyến (online).

#### 📄 [crypto_client.py](file:///c:/Users/ADMIN/BTL_MMHCS-Python/backend/src/lib/crypto_client.py)
- Giao tiếp với một dịch vụ mã hóa bên ngoài (thường chạy ở cổng 4000) để xử lý các phép toán phức tạp của giao thức Signal (tạo khóa, mã hóa, giải mã).

#### 📄 [config.py](file:///c:/Users/ADMIN/BTL_MMHCS-Python/backend/src/lib/config.py)
- Đọc các biến môi trường từ file `.env` (Port, Mongo URI, JWT Secret, API Keys...).

#### 📄 [cloudinary.py](file:///c:/Users/ADMIN/BTL_MMHCS-Python/backend/src/lib/cloudinary.py)
- Xử lý tải ảnh đại diện lên thư mục `/uploads` local (Trong bản này đã được tinh chỉnh để lưu cục bộ thay vì Cloudinary Cloud nếu cần).

#### 📄 [utils.py](file:///c:/Users/ADMIN/BTL_MMHCS-Python/backend/src/lib/utils.py)
- Tiện ích tạo và xác thực JWT (JSON Web Token).

#### 📄 [resend.py](file:///c:/Users/ADMIN/BTL_MMHCS-Python/backend/src/lib/resend.py)
- Tích hợp dịch vụ Resend để gửi email tự động (Welcome Email).

---

### 📂 Middleware (`src/middleware/`)

#### 📄 [auth_middleware.py](file:///c:/Users/ADMIN/BTL_MMHCS-Python/backend/src/middleware/auth_middleware.py)
- **Chức năng**: Bảo vệ các route yêu cầu đăng nhập.
- **Hoạt động**: Kiểm tra JWT trong Cookie của request, nếu hợp lệ thì cho phép đi tiếp và gắn thông tin người dùng vào context.

---

## 3. Luồng hoạt động chính

1. **Đăng ký**: `auth_route` -> `auth_controller` (Signup) -> `crypto_client` (Tạo khóa E2EE) -> `db` (Lưu User) -> `resend` (Gửi email).
2. **Nhắn tin**: 
   - Frontend gửi tin nhắn đã mã hóa.
   - `message_route` -> `message_controller` (Send) -> `db` (Lưu Message).
   - `socket.py` (Emit `newMessage`) -> Người nhận nhận được tin nhắn ngay lập tức.
3. **Mã hóa E2EE**: Người dùng tải bộ khóa công khai lên qua `crypto_route`, người khác lấy về để mã hóa tin nhắn trước khi gửi lên Server.
