from pydantic import BaseModel, Field
from typing import Optional, Union
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

class MessageCreate(BaseModel):
    ciphertext: str
    messageType: Union[int, str]
    sessionId: Optional[str] = None
    image: Optional[str] = None

class Message(BaseModel):
    id: Optional[PyObjectId] = Field(alias='_id', default=None)
    senderId: str
    receiverId: str
    ciphertext: str
    messageType: Union[int, str]
    sessionId: Optional[str] = None
    image: Optional[str] = None
    createdAt: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

class MessageResponse(BaseModel):
    id: Optional[str] = Field(alias='_id', default=None)
    senderId: str
    receiverId: str
    ciphertext: str
    messageType: Union[int, str]
    sessionId: Optional[str] = None
    image: Optional[str] = None
    createdAt: Optional[datetime] = None

    class Config:
        populate_by_name = True