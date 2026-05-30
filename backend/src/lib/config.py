from os import getenv
from dotenv import load_dotenv
load_dotenv()

class Config:
    PORT: int = int(getenv('PORT', 3000))
    MONGO_URI: str = getenv('MONGO_URI', 'mongodb://localhost:27017/chatify')
    JWT_SECRET: str = getenv('JWT_SECRET', '')
    NODE_ENV: str = getenv('NODE_ENV', 'development')
    CLIENT_URL: str = getenv('CLIENT_URL', 'http://localhost:5173')
    CLOUDINARY_CLOUD_NAME: str = getenv('CLOUDINARY_CLOUD_NAME', '')
    CLOUDINARY_API_KEY: str = getenv('CLOUDINARY_API_KEY', '')
    CLOUDINARY_API_SECRET: str = getenv('CLOUDINARY_API_SECRET', '')
    RESEND_API_KEY: str = getenv('RESEND_API_KEY', '')
    EMAIL_FROM: str = getenv('EMAIL_FROM', 'noreply@chatify.com')
    EMAIL_FROM_NAME: str = getenv('EMAIL_FROM_NAME', 'Chatify')
    ARCJET_KEY: str = getenv('ARCJET_KEY', '')
    ARCJET_ENV: str = getenv('ARCJET_ENV', 'development')

    def validate(self):
        if not self.JWT_SECRET:
            raise ValueError('JWT_SECRET is not configured')
        if not self.MONGO_URI:
            raise ValueError('MONGO_URI is not configured')
        return True
config = Config()
config.validate()