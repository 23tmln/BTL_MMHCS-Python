import bcrypt
from bson import ObjectId
from datetime import datetime
import re
from src.lib.db import get_db
from src.lib.utils import generate_token
from src.lib.cloudinary import upload_image
from src.emails.email_handlers import send_welcome_email
from src.lib.config import config
from src.lib.crypto_client import generate_keys_for_user
from src.models.User import UserCreate, UserLogin, UserUpdate

async def signup(email: str, fullName: str, password: str):
    """
    Xử lý việc đăng ký tài khoản mới cho người dùng.
    1. Kiểm tra tính hợp lệ của dữ liệu đầu vào (format email, độ dài mật khẩu).
    2. Kiểm tra xem email đã tồn tại trong cơ sở dữ liệu chưa.
    3. Băm (hash) mật khẩu bằng thư viện bcrypt để bảo mật.
    4. Lưu thông tin người dùng cùng mật khẩu đã băm vào collection 'users'.
    5. Tạo token JWT xác thực, tạo bộ khóa bảo mật (cho Signal Protocol) và gửi email chào đón.
    """
    try:
        db = get_db()
        if not email or not fullName or (not password):
            return ({'error': 'All fields are required'}, 400)
        if len(password) < 6:
            return ({'error': 'Password must be at least 6 characters'}, 400)
        email_regex = '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
        if not re.match(email_regex, email):
            return ({'error': 'Invalid email format'}, 400)
        existing_user = await db['users'].find_one({'email': email})
        if existing_user:
            return ({'error': 'Email already exists'}, 400)
        salt = bcrypt.gensalt(rounds=10)
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
        new_user = {'email': email, 'fullName': fullName, 'password': hashed_password, 'profilePic': '', 'createdAt': datetime.utcnow(), 'updatedAt': datetime.utcnow()}
        result = await db['users'].insert_one(new_user)
        if result.inserted_id:
            token = generate_token(str(result.inserted_id))
            try:
                await generate_keys_for_user(str(result.inserted_id))
            except Exception as e:
                print(f'Failed to generate keys for user {result.inserted_id}: {e}')
            try:
                await send_welcome_email(email, fullName, config.CLIENT_URL)
            except Exception as e:
                print(f'Failed to send welcome email: {e}')
            return ({'_id': str(result.inserted_id), 'email': email, 'fullName': fullName, 'profilePic': ''}, 201, token)
        else:
            return ({'error': 'Invalid user data'}, 400)
    except Exception as e:
        print(f'Error in signup controller: {e}')
        return ({'error': 'Internal server error'}, 500)

async def login(email: str, password: str = None):
    """Handle user login"""
    try:
        db = get_db()

        # Validation
        if not email:
            return {"error": "Email is required"}, 400

        # Passwordless login is used only after the desktop app has completed
        # local passkey + TOTP verification. Only passkey-registered user docs
        # are eligible for this path.
        if password is None or password == "":
            user = await db["users"].find_one({
                "$and": [
                    {
                        "$or": [
                            {"email": email},
                            {"fullName": email},
                            {"email": f"{email}@gmail.com"},
                        ]
                    },
                    {
                        "$or": [
                            {"credential_data": {"$exists": True}},
                            {"credentials": {"$exists": True, "$ne": []}},
                        ]
                    },
                ]
            })

            if not user:
                return {"error": "Passkey credentials are required"}, 400
        else:
            # Find user by email
            user = await db["users"].find_one({"email": email})
            if not user:
                return {"error": "Invalid credentials"}, 400

            stored_password = user.get("password")
            if not stored_password:
                return {"error": "Password login is not available for this account"}, 400

            # Verify password
            is_password_valid = bcrypt.checkpw(
                password.encode("utf-8"),
                stored_password
            )

            if not is_password_valid:
                return {"error": "Invalid credentials"}, 400

        if not user:
            return {"error": "Invalid credentials"}, 400

        # Generate token
        token = generate_token(str(user["_id"]))

        # Remove password from response
        user.pop("password", None)
        user["_id"] = str(user["_id"])

        return user, 200, token
    except Exception as e:
        print(f'Error in login controller: {e}')
        return ({'error': 'Internal server error'}, 500)

async def logout():
    """
    Xử lý yêu cầu đăng xuất. 
    Việc đăng xuất chủ yếu được thực hiện ở client (xóa token khỏi cookie/local storage).
    API này trả về thông báo thành công cho phía frontend.
    """
    try:
        return ({'message': 'Logged out successfully'}, 200)
    except Exception as e:
        print(f'Error in logout controller: {e}')
        return ({'error': 'Internal server error'}, 500)

async def update_profile(user_id: str, fullName: str=None, profilePic: str=None):
    """
    Cập nhật hồ sơ (tên, hình đại diện) của người dùng hiện tại.
    Nếu người dùng có cung cấp ảnh mới (`profilePic`), ảnh đó sẽ được upload lên dịch vụ lưu trữ đám mây (Cloudinary) 
    và URL của ảnh sẽ được lưu lại vào database.
    """
    try:
        db = get_db()
        if not ObjectId.is_valid(user_id):
            return ({'error': 'Invalid user ID'}, 400)
        update_data = {'updatedAt': datetime.utcnow()}
        if fullName:
            update_data['fullName'] = fullName
        if profilePic:
            try:
                image_url = upload_image(profilePic)
                update_data['profilePic'] = image_url
            except Exception as e:
                print(f'Error uploading image: {e}')
                return ({'error': 'Failed to upload image'}, 500)
        result = await db['users'].find_one_and_update({'_id': ObjectId(user_id)}, {'$set': update_data}, return_document=True)
        if not result:
            return ({'error': 'User not found'}, 404)
        result.pop('password', None)
        result['_id'] = str(result['_id'])
        return (result, 200)
    except Exception as e:
        print(f'Error in update_profile controller: {e}')
        return ({'error': 'Internal server error'}, 500)

async def check_auth(user_id: str):
    """
    Kiểm tra trạng thái đăng nhập và trả về thông tin của người dùng.
    Thường được gọi khi tải lại trang để duy trì phiên đăng nhập mà không cần bắt người dùng đăng nhập lại,
    dựa vào token đã được middleware xác thực từ trước.
    """
    try:
        db = get_db()
        if not ObjectId.is_valid(user_id):
            return ({'error': 'Invalid user ID'}, 400)
        user = await db['users'].find_one({'_id': ObjectId(user_id)})
        if not user:
            return ({'error': 'User not found'}, 404)
        user.pop('password', None)
        user['_id'] = str(user['_id'])
        return (user, 200)
    except Exception as e:
        print(f'Error in check_auth controller: {e}')
        return ({'error': 'Internal server error'}, 500)