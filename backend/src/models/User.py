from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError(f'Invalid ObjectId: {v}')
        return ObjectId(v)

class UserBase(BaseModel):
    """
    Schema cơ sở cho người dùng (User).
    Định nghĩa lại các trường thông tin cơ bản nhất.
    """
    email: EmailStr
    fullName: str
    profilePic: Optional[str] = ''

class UserCreate(UserBase):
    password: str

class User(UserBase):
    """
    Schema đại diện cho người dùng khi lưu trữ và try vấn từ MongoDB.
    Bao gồm `id` tự động ánh xạ từ `_id` của thư viện Pydantic/BSON,
    cùng với timestamp (thời gian tạo/cập nhật).
    """
    id: Optional[PyObjectId] = Field(alias='_id', default=None)
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

class UserResponse(BaseModel):
    id: Optional[str] = Field(alias='_id', default=None)
    email: str
    fullName: str
    profilePic: Optional[str] = ''
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    class Config:
        populate_by_name = True

class UserLogin(BaseModel):
    email: EmailStr
    password: Optional[str] = None

class UserUpdate(BaseModel):
    fullName: Optional[str] = None
    profilePic: Optional[str] = None