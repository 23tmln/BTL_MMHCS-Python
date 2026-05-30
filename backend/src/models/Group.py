from datetime import datetime
from typing import Optional
from bson import ObjectId
from pydantic import BaseModel, Field


class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError(f"Invalid ObjectId: {v}")
        return ObjectId(v)


class GroupCreate(BaseModel):
    name: str
    memberIds: list[str] = []


class Group(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    adminId: PyObjectId
    memberIds: list[PyObjectId]
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class GroupMessageCreate(BaseModel):
    text: Optional[str] = None
    image: Optional[str] = None


class MlsCredentialCreate(BaseModel):
    credential: str
    signatureKey: Optional[str] = None


class MlsKeyPackageCreate(BaseModel):
    credentialId: Optional[str] = None
    keyPackage: str


class GroupMessage(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    groupId: PyObjectId
    senderId: PyObjectId
    text: Optional[str] = None
    image: Optional[str] = None
    createdAt: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
