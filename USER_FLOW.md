# User Flow Summary (Hướng dẫn Người dùng)

Tài liệu này tóm tắt các bước trải nghiệm ứng dụng Chatify từ góc độ người dùng cuối.

---

### 1. Đăng ký & Đăng nhập
- **Đăng ký**: Người dùng tạo tài khoản mới với Họ tên, Email và Mật khẩu. Hệ thống sẽ tự động khởi tạo "Căn cước mã hóa" (Keys) ngay lần đầu tiên.
- **Đăng nhập**: Sử dụng Email/Mật khẩu đã đăng ký. Nếu đăng nhập trên thiết bị mới, hệ thống sẽ nhận diện và yêu cầu khôi phục khóa.

### 2. Thiết lập Bảo mật (Passphrase)
- **Lần đầu sử dụng**: Sau khi vào ứng dụng, một bảng thông báo yêu cầu tạo **Passphrase** (Mật khẩu cấp 2). 
- **Tác dụng**: Passphrase này dùng để mã hóa toàn bộ khóa bí mật và lịch sử tin nhắn của bạn để đưa lên đám mây (Cloud Backup). Nếu mất Passphrase, bạn sẽ mất lịch sử tin nhắn khi đổi thiết bị.

### 3. Trò chuyện Mã hóa (E2EE)
- **Gửi tin nhắn**: Khi bạn gõ và gửi, tin nhắn được mã hóa ngay tại trình duyệt của bạn trước khi gửi đi. Chỉ người nhận mới có thể đọc được.
- **Nhận tin nhắn**: Tin nhắn đến sẽ tự động được giải mã và hiển thị. Nếu có âm báo, bạn sẽ nhận được thông báo ngay lập tức.
- **Biểu tượng khóa**: Các tin nhắn cũ hoặc tin nhắn chưa thể giải mã sẽ hiển thị biểu tượng 🔒 để đảm bảo tính riêng tư.

### 4. Khôi phục Lịch sử (Restore)
- **Khi cài lại máy hoặc đổi trình duyệt**: Sau khi đăng nhập, hệ thống sẽ hỏi Passphrase.
- **Thao tác**: Nhập đúng Passphrase -> Toàn bộ tin nhắn cũ và danh sách chat sẽ tự động xuất hiện trở lại như chưa từng biến mất.
- **Tạo mới**: Nếu quên Passphrase, bạn có thể chọn "Tạo khóa mới", nhưng lưu ý toàn bộ tin nhắn cũ sẽ không thể đọc được nữa.

### 5. Quản lý Tài khoản
- **Cập nhật Profile**: Thay đổi ảnh đại diện hoặc tên hiển thị.
- **Đăng xuất**: Thoát khỏi tài khoản. Dữ liệu mã hóa vẫn được giữ an toàn trong trình duyệt để bạn không phải nhập Passphrase mỗi lần quay lại trên cùng một máy.

---
**Lưu ý quan trọng**: Tuyệt đối không chia sẻ Passphrase cho bất kỳ ai, kể cả quản trị viên hệ thống.
