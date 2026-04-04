from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import asyncio
from src.lib.config import config
db: AsyncIOMotorDatabase = None
client: AsyncIOMotorClient = None

async def connect_db():
    global db, client
    try:
        client = AsyncIOMotorClient(config.MONGO_URI)
        db = client.chatify
        await db.command('ping')
        print(f'MONGODB CONNECTED: {client.address}')
    except Exception as error:
        print(f'Error connecting to MONGODB: {error}')
        raise

async def disconnect_db():
    global db, client
    if client is not None:
        client.close()
        print('MONGODB DISCONNECTED')

def get_db() -> AsyncIOMotorDatabase:
    if db is None:
        raise RuntimeError('Database not connected')
    return db