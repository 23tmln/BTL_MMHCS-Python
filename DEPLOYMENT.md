# 🚀 Hướng dẫn Triển khai (Deployment Guide)

Tài liệu này hướng dẫn bạn cách chuyển đổi từ môi trường phát triển (Mạng LAN/Local) sang triển khai thực tế trên Internet (Production).

## 🔒 1. Chứng chỉ SSL (HTTPS)

Để giao thức Passkey và E2EE hoạt động ổn định trên điện thoại và trình duyệt bên ngoài, bạn **bắt buộc** phải sử dụng chứng chỉ SSL hợp lệ (không dùng self-signed).

### Tên miền (Domain)
*   Mua một tên miền (Ví dụ: `chatify.com`).
*   Trỏ các bản ghi A tới địa chỉ IP của server.

### Cài đặt SSL (Let's Encrypt)
Sử dụng công cụ `certbot` để cài đặt SSL miễn phí cho Nginx:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d chatify.com
```

---

## 🏗️ 2. Cấu trúc Proxy (Nginx)

Sử dụng Nginx làm reverse proxy để điều phối lưu lượng cho Frontend và Backend. Cấu hình ví dụ:

```nginx
server {
    listen 80;
    server_name chatify.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name chatify.com;

    # Frontend (Vite Build)
    location / {
        root /var/www/chatify/frontend/dist;
        index index.html;
        try_files $uri /index.html;
    }

    # Backend API (FastAPI)
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSockets (Socket.IO)
    location /socket.io {
        proxy_pass http://localhost:3000/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

---

## 📦 3. Triển khai Backend (Python)

Trong môi trường Production, nên sử dụng `Gunicorn` kết hợp với `Uvicorn workers` để tăng hiệu năng và độ ổn định:

```bash
# Cài đặt Gunicorn
pip install gunicorn

# Chạy Server
gunicorn -w 4 -k uvicorn.workers.UvicornWorker src.server:app --bind 0.0.0.0:3000
```

Dùng `systemd` để duy trì server chạy ngầm:
*   Tạo file `/etc/systemd/system/chatify-backend.service`.

---

## 🛠️ 4. Khởi tạo Production Build (Frontend)

Tại máy local hoặc server CI/CD:
```bash
cd frontend
npm run build
```
Sau đó, copy thư mục `dist/` vào website root của Nginx (`/var/www/chatify/frontend/dist`).

---

## ⚙️ 5. Cập nhật Biến môi trường (.env)

Cập nhật các biến sau từ `localhost` sang tên miền thật:
*   `CLIENT_URL=https://chatify.com`
*   `MONGO_URI`: Kết nối cơ sở dữ liệu MongoDB thật.
*   `JWT_SECRET`: Sử dụng chuỗi ký tự dài và bảo mật cao.
*   `RESEND_API_KEY`: Đăng ký tài khoản Resend để gửi email thật.
