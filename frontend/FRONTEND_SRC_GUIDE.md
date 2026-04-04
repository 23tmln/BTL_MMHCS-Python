# Hướng dẫn chi tiết mã nguồn Frontend (src)

Tài liệu này giải thích chi tiết chức năng của từng thư mục và file trong mã nguồn frontend của dự án **BTL_MMHCS-Python**.

---

## 1. Cấu trúc thư mục tổng quan

Thư mục `frontend/src` được xây dựng bằng **React** và **Vite**, sử dụng **Zustand** để quản lý trạng thái và **Signal Protocol** để mã hóa tin nhắn đầu cuối (E2EE).

- `components/`: Các thành phần giao diện tái sử dụng.
- `hooks/`: Các React hooks tùy chỉnh.
- `lib/`: Các thư viện tiện ích (Crypto, API, Storage).
- `pages/`: Các trang chính của ứng dụng.
- `store/`: Quản lý trạng thái toàn cục (Global State).
- `App.jsx`: Cấu hình định tuyến và kiểm tra xác thực.
- `main.jsx`: Điểm nhập (Entry point) của ứng dụng.

---

## 2. Chi tiết từng thư mục và File

### 📂 Root (`src/`)

#### 📄 [App.jsx](file:///c:/Users/ADMIN/BTL_MMHCS-Python/frontend/src/App.jsx)
- **Chức năng**: Quản lý luồng điều hướng (Routing) chính.
- **Nội dung**:
  - Kiểm tra trạng thái đăng nhập (`checkAuth`) khi ứng dụng khởi chạy.
  - Định nghĩa các Route: `/`, `/login`, `/signup`.
  - Hiển thị `PageLoader` khi đang kiểm tra xác thực.

#### 📄 [main.jsx](file:///c:/Users/ADMIN/BTL_MMHCS-Python/frontend/src/main.jsx)
- **Chức năng**: Gắn ứng dụng React vào DOM.
- **Nội dung**: Sử dụng `StrictMode` và `BrowserRouter`.

---

### 📂 Pages (`src/pages/`)

#### 📄 [ChatPage.jsx](file:///c:/Users/ADMIN/BTL_MMHCS-Python/frontend/src/pages/ChatPage.jsx)
- **Chức năng**: Trang giao diện chính sau khi đăng nhập.
- **Nội dung**: 
  - Hiển thị danh sách chat, danh sách liên hệ và khung chat.
  - Tự động tải danh sách bạn chat khi E2EE đã được cấu hình.
  - Chứa `PassphraseModal` để yêu cầu người dùng nhập mật khẩu giải mã nếu cần.

#### 📄 [LoginPage.jsx](file:///c:/Users/ADMIN/BTL_MMHCS-Python/frontend/src/pages/LoginPage.jsx) & [SignUpPage.jsx](file:///c:/Users/ADMIN/BTL_MMHCS-Python/frontend/src/pages/SignUpPage.jsx)
- **Chức năng**: Giao diện đăng nhập và đăng ký.
- **Nội dung**: Xử lý form đầu vào và gọi các hàm `login`/`signup` từ `useAuthStore`.

---

### 📂 Store (`src/store/`) - Quản lý trạng thái bằng Zustand

#### 📄 [useAuthStore.js](file:///c:/Users/ADMIN/BTL_MMHCS-Python/frontend/src/store/useAuthStore.js)
- **Chức năng quan trọng nhất**: Quản lý thông tin người dùng và **Xác thực E2EE**.
- **Nội dung chính**:
  - `checkLocalIdentity`: Kiểm tra xem trình duyệt đã có khóa mã hóa chưa. Nếu chưa, sẽ kiểm tra backup trên server hoặc tạo mới.
  - `backupKeysWithPassphrase`: Mã hóa bộ khóa cá nhân bằng mật khẩu (passphrase) và đẩy lên server để sao lưu.
  - `restoreKeysWithPassphrase`: Tải bản backup từ server và giải mã bằng mật khẩu để khôi phục lịch sử chat.
  - Quản lý kết nối Socket.IO (`connectSocket`).

#### 📄 [useChatStore.js](file:///c:/Users/ADMIN/BTL_MMHCS-Python/frontend/src/store/useChatStore.js)
- **Chức năng**: Quản lý tin nhắn và danh sách bạn chat.
- **Nội dung chính**:
  - `getMessagesByUserId`: Tải tin nhắn và thực hiện **giải mã từng tin nhắn** bằng Signal Protocol.
  - `sendMessage`: Thực hiện **mã hóa tin nhắn** trên máy người gửi trước khi đẩy lên Server.
  - `subscribeToMessages`: Lắng nghe tin nhắn mới từ Socket.IO và giải mã ngay lập tức.
  - `cacheMessage`: Lưu tin nhắn đã giải mã vào IndexedDB (để có thể đọc lại sau này mà không cần giải mã lại - giống cơ chế của Zalo/WhatsApp).

---

### 📂 Library (`src/lib/`) - Logic xử lý nền

#### 📄 [signalHelper.js](file:///c:/Users/ADMIN/BTL_MMHCS-Python/frontend/src/lib/signalHelper.js)
- **Chức năng**: Cầu nối với thư viện `libsignal`. Xử lý tạo khóa, thiết lập phiên (session) mã hóa X3DH và Double Ratchet.

#### 📄 [cryptoBackup.js](file:///c:/Users/ADMIN/BTL_MMHCS-Python/frontend/src/lib/cryptoBackup.js)
- **Chức năng**: Sử dụng **Web Crypto API** để mã hóa bộ khóa riêng tư của người dùng bằng mật khẩu (PBKDF2 + AES-GCM) trước khi lưu lên server.

#### 📄 [secureStore.js](file:///c:/Users/ADMIN/BTL_MMHCS-Python/frontend/src/lib/secureStore.js)
- **Chức năng**: Sử dụng **IndexedDB** để lưu trữ bền vững các khóa mã hóa, dữ liệu phiên và bộ nhớ đệm tin nhắn (Plaintext Cache) ngay tại trình duyệt.

#### 📄 [axios.js](file:///c:/Users/ADMIN/BTL_MMHCS-Python/frontend/src/lib/axios.js)
- **Chức năng**: Cấu hình Axios để gọi API (bao gồm gửi kèm cookie xác thực).

---

### 📂 Components (`src/components/`) - Thành phần giao diện

- 📄 **ChatContainer.jsx**: Khung hiển thị nội dung tin nhắn, tự động cuộn xuống dưới cùng.
- 📄 **PassphraseModal.jsx**: Cửa sổ yêu cầu nhập passphrase để bảo vệ/khôi phục khóa mã hóa. Đây là thành phần cực kỳ quan trọng cho bảo mật E2EE.
- 📄 **MessageInput.jsx**: Ô nhập tin nhắn, hỗ trợ gửi ảnh và phát âm thanh tiếng gõ phím.
- 📄 **ProfileHeader.jsx**: Hiển thị thông tin cá nhân, nút đăng xuất, bật/tắt âm thanh và nút sao lưu khóa thủ công.
- 📄 **BorderAnimatedContainer.jsx**: Thành phần bao bọc với hiệu ứng viền phát sáng thẩm mỹ.

---

## 3. Luồng hoạt động E2EE tại Frontend

1. **Khi gửi tin nhắn**:
   - `useChatStore` lấy nội dung văn bản.
   - Gọi `signalHelper` để mã hóa văn bản thành `ciphertext`.
   - Gửi `ciphertext` lên Backend qua API.
   - Lưu nội dung gốc vào `secureStore` (IndexedDB) để hiển thị phía mình.

2. **Khi nhận tin nhắn**:
   - Nhận `ciphertext` từ API hoặc Socket.
   - Kiểm tra trong `secureStore` xem đã giải mã chưa.
   - Nếu chưa, gọi `signalHelper` để giải mã và lưu lại bản gốc vào Cache.

3. **Khi đăng nhập máy mới**:
   - Ứng dụng thấy không có khóa nội bộ.
   - Hiện `PassphraseModal` yêu cầu nhập mật khẩu.
   - Dùng `cryptoBackup` để giải mã bản backup từ Cloud và nạp lại vào `secureStore`.
