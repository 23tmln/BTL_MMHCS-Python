from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError(f"Invalid ObjectId: {v}")
        return ObjectId(v)

class KeyBundle(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    userId: str
    bundle: Dict[str, Any]

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
