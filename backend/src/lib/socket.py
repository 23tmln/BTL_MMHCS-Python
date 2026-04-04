import socketio
import logging
from typing import Dict, Optional
logger = logging.getLogger(__name__)
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins=['*'], ping_timeout=60, ping_interval=25, engineio_logger=False, logger=False)
user_socket_map: Dict[str, str] = {}

def get_receiver_socket_id(user_id: str) -> Optional[str]:
    return user_socket_map.get(str(user_id))

def get_online_users() -> list:
    return list(user_socket_map.keys())

async def emit_online_users():
    await sio.emit('getOnlineUsers', get_online_users())

async def emit_new_message(receiver_id: str, message_data: dict):
    logger.info(f'[Socket.IO] emit_new_message() called for receiver: {receiver_id}')
    receiver_socket_id = get_receiver_socket_id(receiver_id)
    logger.info(f'[Socket.IO] Online users: {get_online_users()}')
    logger.info(f'[Socket.IO] Receiver socket ID: {receiver_socket_id}')
    if receiver_socket_id:
        try:
            await sio.emit('newMessage', message_data, room=receiver_socket_id)
            logger.info(f'[Socket.IO] Message emitted successfully to socket {receiver_socket_id}')
        except Exception as e:
            logger.error(f'[Socket.IO] Error emitting message: {e}')
    else:
        logger.warning(f'[Socket.IO] Receiver {receiver_id} is not online or not registered in user_socket_map')

@sio.event
async def connect(sid, environ):
    try:
        logger.info(f'[Socket.IO] Client {sid} connected')
        logger.info(f'[Socket.IO] Current online users: {get_online_users()}')
    except Exception as e:
        logger.error(f'Error in connect handler: {e}')

@sio.event
async def disconnect(sid):
    try:
        user_id = None
        for (uid, socket_id) in list(user_socket_map.items()):
            if socket_id == sid:
                user_id = uid
                del user_socket_map[uid]
                break
        if user_id:
            logger.info(f'[Socket.IO] User {user_id} disconnected (socket: {sid})')
            await emit_online_users()
    except Exception as e:
        logger.error(f'Error in disconnect handler: {e}')

@sio.event
async def user_connected(sid, data):
    try:
        user_id = data.get('userId')
        if user_id:
            user_socket_map[str(user_id)] = sid
            logger.info(f'[Socket.IO] User {user_id} registered online (socket: {sid})')
            logger.info(f'[Socket.IO] Total online users: {len(user_socket_map)}')
            logger.info(f'[Socket.IO] Online users map: {user_socket_map}')
            await emit_online_users()
    except Exception as e:
        logger.error(f'Error in user_connected: {e}')