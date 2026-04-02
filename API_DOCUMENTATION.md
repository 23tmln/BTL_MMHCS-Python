# 📖 Tài liệu API Chatify E2EE & Passkey

Tài liệu này cung cấp danh sách các API chính của hệ thống Chatify phục vụ cho việc đăng nhập, tính năng mã hóa đầu cuối (E2EE) và xác thực Passkey.

## 🔑 1. Xác thực (Authentication)

Tất cả các endpoint dưới đây đều nằm dưới tiền tố `/api/auth`.

### Đăng ký / Đăng nhập thủ công
*   `POST /signup`: Tạo người dùng mới.
*   `POST /login`: Đăng nhập bằng Email/Password truyền thống (Trình duyệt sẽ nhận HTTPOnly Cookie).
*   `POST /logout`: Hủy phiên đăng nhập.
*   `GET /check`: Kiểm tra trạng thái đăng nhập dựa trên Cookie.

### Xác thực Passkey (FIDO2/WebAuthn)
*   `POST /webauthn/register/options`: Lấy thông tin Challenge từ máy chủ cho việc tạo Passkey mới.
*   `POST /webauthn/register/verify`: Gửi Attestation từ thiết bị lên máy chủ để hoàn thành đăng ký.
*   `POST /webauthn/login/options`: Lấy Challenge và danh sách khóa cho phép từ máy chủ để đăng nhập.
*   `POST /webauthn/login/verify`: Gửi Assertion từ thiết bị để xác thực danh tính.

---

## 🛡️ 2. Giao thức Mã hóa (E2EE - Signal Protocol)

Quản lý việc truyền tải các Public Bundle để thiết lập kênh chat mã hóa. Endpoint gốc: `/api/messages`.

### Quản lý Khóa (Key Management)
*   `POST /set-bundle`: Đăng tải Public Key Bundle của người dùng lên server (Identity Key, Signed PreKey, One-time PreKeys).
*   `GET /bundle/{userId}`: Lấy Public Key Bundle của người dùng khác để khởi tạo phiên chat mã hóa (X3DH).

### Truyền tải Tin nhắn (Message Transport)
*   `GET /contacts`: Lấy danh sách người dùng để bắt đầu chat.
*   `GET /history/{userId}`: Lấy danh sách tin nhắn mã hóa (Ciphertexts) giữa mình và đối phương.
*   `POST /send`: Gửi tin nhắn mã hóa. Dữ liệu gửi đi phải có dạng:
    ```json
    {
      "recipientId": "ID_NGUOI_NHAN",
      "ciphertext": "BASE64_ENCRYPTED_DATA",
      "type": "text/image"
    }
    ```

---

## ☁️ 3. Sao lưu & Khôi phục (Backup & Restore)

*   `POST /backup`: Đẩy file Blob đã được mã hóa bằng AES-GCM (với mầm là Passphrase của người dùng) lên MongoDB. 
*   `GET /restore`: Tải về bản backup Blob mới nhất để khôi phục Keys, Sessions và Tin nhắn trên thiết bị mới.

---

## 🌐 4. Thời gian thực (Socket.IO)

Sử dụng WebSocket để thông báo sự kiện tức thời:
*   `connection`: Khi người dùng trực tuyến.
*   `newMessage`: Nhận gói tin mã hóa từ người khác.
*   `onlineUsers`: Nhận danh sách người dùng đang trực tuyến trong mạng LAN.
