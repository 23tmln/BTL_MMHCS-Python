from datetime import datetime
from src.lib.db import get_db
from src.lib.crypto_client import backup_user_state, restore_user_state

async def setup_secure_storage(user_id: str, pin: str):
    """
    Khởi tạo tính năng sao lưu an toàn (secure storage) cho trạng thái Signal Protocol của người dùng.
    Dùng mã PIN cung cấp ở mức người dùng để mã hóa trạng thái local chứa khóa riêng tư. 
    Các thông số như encryptedState, salt, iv, authTag sẽ được lưu gọn lên database.
    """
    db = get_db()
    existing = await db['secure_storage'].find_one({'userId': user_id})
    if existing:
        return ({'error': 'Secure storage already configured for this user'}, 409)
    crypto_state = await backup_user_state(user_id, pin)
    now = datetime.utcnow()
    payload = {'userId': user_id, 'encryptedState': crypto_state['encryptedState'], 'salt': crypto_state['salt'], 'iv': crypto_state['iv'], 'authTag': crypto_state['authTag'], 'version': crypto_state.get('version', 1), 'createdAt': now, 'updatedAt': now}
    await db['secure_storage'].insert_one(payload)
    return ({'message': 'Secure storage setup complete', 'version': payload['version'], 'userId': user_id, 'updatedAt': now}, 201)

async def backup_secure_storage(user_id: str, pin: str):
    """
    Cập nhật bản sao lưu an toàn hiện có trên database (vì trạng thái key/session của protocol 
    có thể thay đổi liên tục sau mỗi tin nhắn). Quá trình này sẽ lấy trạng thái mới nhất, mã hóa, 
    và ghi đè lên db server.
    """
    db = get_db()
    existing = await db['secure_storage'].find_one({'userId': user_id})
    if not existing:
        return ({'error': 'No secure storage record found for this user'}, 404)
    crypto_state = await backup_user_state(user_id, pin)
    now = datetime.utcnow()
    update = {'$set': {'encryptedState': crypto_state['encryptedState'], 'salt': crypto_state['salt'], 'iv': crypto_state['iv'], 'authTag': crypto_state['authTag'], 'version': crypto_state.get('version', existing.get('version', 1)), 'updatedAt': now}}
    await db['secure_storage'].update_one({'userId': user_id}, update)
    return ({'message': 'Secure storage backup updated', 'version': update['$set']['version'], 'userId': user_id, 'updatedAt': now}, 200)

async def restore_secure_storage(user_id: str, pin: str):
    """
    Khôi phục trạng thái bộ sinh khóa/session Signal Protocol từ bản sao lưu an toàn trên server.
    Dùng cho trường hợp khi người dùng đăng nhập bằng thiết bị mới, họ cần nhập mã PIN đúng
    để server giải mã lại trạng thái trước khi cho phép đọc/gửi tin nhắn cũ/mới hợp lệ.
    """
    db = get_db()
    existing = await db['secure_storage'].find_one({'userId': user_id})
    if not existing:
        return ({'error': 'No secure storage record found for this user'}, 404)
    await restore_user_state(user_id, pin, existing['encryptedState'], existing['salt'], existing['iv'], existing['authTag'])
    now = datetime.utcnow()
    await db['secure_storage'].update_one({'userId': user_id}, {'$set': {'updatedAt': now}})
    return ({'message': 'Secure storage restored', 'userId': user_id, 'updatedAt': now}, 200)

async def status_secure_storage(user_id: str):
    """
    Truy vấn để kiểm tra xem tải khoản này đã từng cấu hình Sao lưu mã PIN (secure storage backup) trên server chưa.
    Thường để Frontend quyết định xem có bật modal yêu cầu tạo PIN trên app cho họ hay không.
    """
    db = get_db()
    existing = await db['secure_storage'].find_one({'userId': user_id})
    if not existing:
        return ({'userId': user_id, 'configured': False}, 200)
    return ({'userId': user_id, 'configured': True, 'createdAt': existing.get('createdAt'), 'updatedAt': existing.get('updatedAt')}, 200)