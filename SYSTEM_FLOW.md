# System Flow Summary (Cơ chế hoạt động hệ thống)

Tài liệu này tóm tắt các thành phần kỹ thuật và luồng xử lý dữ liệu của hệ thống Chatify E2EE.

---

### 1. Kiến trúc Tổng quan (Architecture)
- **Frontend**: React (Vite) + Zustand (State management). Thực hiện toàn bộ logic mã hóa/giải mã và quản lý DB cục bộ (IndexedDB).
- **Backend (API)**: Python FastAPI. Quản lý xác thực (JWT), lưu trữ bản tin nhắn mã hóa (Ciphertext) và các bản Backup (Blobs).
- **Real-time**: Socket.IO. Đảm bảo thông báo tin nhắn và trạng thái online tức thời.
- **Protocol**: **Signal Protocol** (x3DH + Double Ratchet). Đảm bảo tính bảo mật đầu cuối tuyệt đối.

### 2. Luồng bảo mật Tin nhắn (E2EE Messaging)
- **Mã hóa (Sender Side)**: 
  - Lấy Public Key của người nhận từ Backend.
  - Signal Protocol (Curve25519) thực hiện Diffie-Hellman tạo Key phiên.
  - Gửi Ciphertext (Dữ liệu mã hóa) lên máy chủ.
- **Giải mã (Recipient Side)**:
  - Nhận Ciphertext từ bưu cục (Socket.IO).
  - Dùng Secret Key nằm tại IndexedDB của riêng bạn để mở khóa.
  - Lưu vào **Message Cache** để không phải giải mã lại.

### 3. Cơ chế Khôi phục & Sao lưu (Security Persistence)
- **PBKDF2 & AES-256-GCM**: Dùng Passphrase của người dùng làm mầm (Seed) để sinh khóa mã hóa (Wrapping Key).
- **Backup Blobs**: Nén toàn bộ Keys, Sessions và Message Cache thành một khối (Blob) đã mã hóa và đẩy lên MongoDB. 
- **Auto-Backups**: Ổn định hóa trạng thái backup liên tục mỗi khi có tin nhắn mới mà người dùng không cần quan tâm.

### 4. Tính năng Tự phục hồi (Key Replenishment)
- **Forward Secrecy**: Các khóa One-Time PreKey sẽ tự động bị xóa sau khi sử dụng để tin tặc không thể giải mã nội dung cũ dù có chiếm được khóa bí mật IdentityKey.
- **Auto-Replenish**: Frontend tự động nhận diện nếu thiếu khóa công khai dạo (One-Time PreKey) để sinh khóa mới và đồng bộ lại cho Server.

### 5. Quản lý Dữ liệu Cục bộ (IndexedDB)
- **Keys Store**: Lưu căn cước mã hóa cá nhân.
- **Sessions Store**: Lưu trạng thái phiên chat với từng đối tác.
- **MessageCache Store**: Lưu bản thô (Plaintext) của các tin nhắn đã giải mã xong, là lõi của tính năng xem lại lịch sử sau khi Restore.

---
**Cam kết bảo mật**: Máy chủ (Backend) và Cơ sở dữ liệu (Database) không nắm giữ bất kỳ khóa bí mật nào của người dùng. Mọi nỗ lực xâm nhập vào Database cũng chỉ thu được các bản tin nhắn vô nghĩa.
