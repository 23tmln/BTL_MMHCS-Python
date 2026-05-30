from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SecureStorageBase(BaseModel):
    """
    Khối Schema liên quan đến xác thực và thông tin phản hồi của tính năng Sao lưu an toàn (Secure Storage).
    `pin` là mã PIN định danh từ user gửi lên để mã hóa / giải mã state.
    """
    pin: str

class SecureStorageStatusResponse(BaseModel):
    userId: str
    configured: bool
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

class SecureStorageBackupResponse(BaseModel):
    message: str
    version: int
    userId: str
    updatedAt: Optional[datetime] = None