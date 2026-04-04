from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SecureStorageBase(BaseModel):
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