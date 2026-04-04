import jwt
from datetime import datetime, timedelta
from src.lib.config import config
from typing import Dict, Any

def generate_token(user_id: str) -> str:
    if not config.JWT_SECRET:
        raise ValueError('JWT_SECRET is not configured')
    payload = {'userId': str(user_id), 'iat': datetime.utcnow(), 'exp': datetime.utcnow() + timedelta(days=7)}
    token = jwt.encode(payload, config.JWT_SECRET, algorithm='HS256')
    return token

def verify_token(token: str) -> Dict[str, Any]:
    if not config.JWT_SECRET:
        raise ValueError('JWT_SECRET is not configured')
    try:
        decoded = jwt.decode(token, config.JWT_SECRET, algorithms=['HS256'])
        return decoded
    except jwt.ExpiredSignatureError:
        raise ValueError('Token has expired')
    except jwt.InvalidTokenError:
        raise ValueError('Invalid token')