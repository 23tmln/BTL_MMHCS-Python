"""
Socket.IO configuration for real-time messaging
Uses python-socketio with ASGI compatibility
"""

import socketio
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Create Socket.IO server instance with ASGI support
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=['*'],
    ping_timeout=60,
    ping_interval=25,
    engineio_logger=False,
    logger=False
)

# Dictionary to store online users: {user_id: socket_id}
user_socket_map: Dict[str, str] = {}

def get_receiver_socket_id(user_id: str) -> Optional[str]:
    """Get socket ID for a specific user"""
    return user_socket_map.get(str(user_id))

def get_online_users() -> list:
    """Get list of online user IDs"""
    return list(user_socket_map.keys())

async def emit_online_users():
    """Broadcast online users list to all connected clients"""
    # In python-socketio, emit without specifying a room broadcasts to all clients
    await sio.emit("getOnlineUsers", get_online_users())

async def emit_new_message(receiver_id: str, message_data: dict):
    """Emit new message to receiver if they're online"""
    logger.info(f"[Socket.IO] emit_new_message() called for receiver: {receiver_id}")
    receiver_socket_id = get_receiver_socket_id(receiver_id)
    logger.info(f"[Socket.IO] Online users: {get_online_users()}")
    logger.info(f"[Socket.IO] Receiver socket ID: {receiver_socket_id}")

    if receiver_socket_id:
        try:
            await sio.emit("newMessage", message_data, room=receiver_socket_id)
            logger.info(f"[Socket.IO] Message emitted successfully to socket {receiver_socket_id}")
        except Exception as e:
            logger.error(f"[Socket.IO] Error emitting message: {e}")
    else:
        logger.warning(f"[Socket.IO] Receiver {receiver_id} is not online or not registered in user_socket_map")

async def emit_new_group_message(member_ids: list[str], message_data: dict, sender_id: str):
    """Emit a group message to online group members except the sender."""
    logger.info(f"[Socket.IO] emit_new_group_message() called for group: {message_data.get('groupId')}")
    for member_id in member_ids:
        member_id_str = str(member_id)
        if member_id_str == str(sender_id):
            continue

        socket_id = get_receiver_socket_id(member_id_str)
        if not socket_id:
            continue

        try:
            await sio.emit("newGroupMessage", message_data, room=socket_id)
            logger.info(f"[Socket.IO] Group message emitted to user {member_id_str}")
        except Exception as e:
            logger.error(f"[Socket.IO] Error emitting group message to {member_id_str}: {e}")

@sio.event
async def connect(sid, environ):
    """Handle client connection"""
    try:
        logger.info(f"[Socket.IO] Client {sid} connected")
        logger.info(f"[Socket.IO] Current online users: {get_online_users()}")
    except Exception as e:
        logger.error(f"Error in connect handler: {e}")

@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    try:
        # Find and remove user from online map
        user_id = None
        for uid, socket_id in list(user_socket_map.items()):
            if socket_id == sid:
                user_id = uid
                del user_socket_map[uid]
                break

        if user_id:
            logger.info(f"[Socket.IO] User {user_id} disconnected (socket: {sid})")
            # Broadcast updated online users list
            await emit_online_users()
    except Exception as e:
        logger.error(f"Error in disconnect handler: {e}")

@sio.event
async def user_connected(sid, data):
    """Handle user connection with user ID (called by client after authentication)"""
    try:
        user_id = data.get("userId")
        if user_id:
            user_socket_map[str(user_id)] = sid
            logger.info(f"[Socket.IO] User {user_id} registered online (socket: {sid})")
            logger.info(f"[Socket.IO] Total online users: {len(user_socket_map)}")
            logger.info(f"[Socket.IO] Online users map: {user_socket_map}")
            # Broadcast updated online users list
            await emit_online_users()
    except Exception as e:
        logger.error(f"Error in user_connected: {e}")