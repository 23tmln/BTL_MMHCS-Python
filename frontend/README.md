# 🛡️ Frontend - Ứng dụng Trò chuyện Bảo mật E2EE (Secure Chat App)

Dự án Frontend cho phần mềm Trò chuyện Bảo mật, được xây dựng với React, Vite, và TailwindCSS. Dự án cung cấp một giao diện trò chuyện hiện đại với các hệ thống mã hóa đầu cuối (E2EE) và giao thức xác thực nâng cao.

## 🌟 Các tính năng chính

- **Mã hoá đầu cuối (End-to-End Encryption - E2EE)**: Tích hợp Giao thức Signal (sử dụng `@privacyresearch/libsignal-protocol-typescript` và `curve25519-typescript`), đảm bảo toàn bộ tin nhắn được mã hóa hoàn toàn, chỉ người gửi và người nhận mới có thể đọc được nội dung trên thiết bị thông qua các khóa cục bộ.
- **Xác thực Phi mật khẩu (FIDO2 Passkeys)**: Sử dụng các phương thức xác thực sinh trắc học hoặc thiết bị an toàn thay cho mật khẩu truyền thống, chống chịu hoàn toàn trước các cuộc tấn công Phishing. Cung cấp quy trình sao lưu và quản lý khóa người dùng an toàn giữa các thiết bị.
- **Trải nghiệm UX/UI Hiện đại**: Sử dụng DaisyUI và TailwindCSS để tạo giao diện phản hồi nhanh, bao gồm cả chế độ Sáng/Tối.
- **Trò chuyện Thời gian thực (Real-time)**: Giao tiếp tin nhắn và trạng thái online/offline theo thời gian thực sử dụng Socket.IO.
- **Lưu trữ An toàn (Secure Local Storage)**: Quản lý khóa mã hóa cục bộ và tin nhắn với cấu trúc IndexedDB đa luồng.

## 🛠️ Công nghệ sử dụng

- **Khung phát triển**: React 19, Vite (có plugin HTTPS/Wasm)
- **Quản lý Trạng thái**: Zustand
- **Truyền thông Realtime**: Socket.IO Client
- **Bảo mật**: libsignal-protocol-typescript, FIDO2/WebAuthn API, IDB (IndexedDB)
- **Thiết kế**: TailwindCSS, DaisyUI, Lucide React

## 🚀 Hướng dẫn cài đặt và sử dụng

### Yêu cầu tiên quyết
- [Node.js](https://nodejs.org/en/) (phiên bản 18+).
- Cấu hình môi trường mạng (LAN/Local) phù hợp để chạy chứng chỉ (HTTPS) và thử nghiệm Passkey.

### Các bước cài đặt

1. Đi tới thư mục frontend:
   ```bash
   cd frontend
   ```

2. Cài đặt các gói thư viện phụ thuộc:
   ```bash
   npm install
   ```

3. (Tùy chọn) Cấu hình các biến môi trường tại `.env.local` nếu máy chủ backend không lưu trú trên thiết lập mặc định (Vite dev server đang được cấu hình cùng HTTPS).

4. Chạy ứng dụng trong môi trường phát triển:
   ```bash
   npm run dev
   ```

5. Sau khi server hiển thị trên Terminal, bạn có thể truy cập vào đường dẫn cục bộ hoặc địa chỉ mạng LAN (ví dụ: `https://172.20.10.x:5173`).

## 📁 Cấu trúc thư mục định hướng

* `src/components`: Các component độc lập của giao diện (Chat, Sidebar, Auth, v.v.)
* `src/store`: Khởi tạo Zustand cho thư mục điều khiển logic.
* `src/lib`: Chứa các thuật toán sinh khóa, cấu hình mã hóa Signal và các hàm hỗ trợ WebAuthn.
* `src/pages`: Thư mục các màn hình điều hướng tuyến (Login, Signup, Profile, Settings)
