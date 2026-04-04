from bson import ObjectId
from datetime import datetime
from src.lib.db import get_db
from src.lib.cloudinary import upload_image
from src.lib.socket import get_receiver_socket_id, emit_new_message, emit_online_users

async def get_all_contacts(user_id: str):
    try:
        db = get_db()
        if not ObjectId.is_valid(user_id):
            return ({'error': 'Invalid user ID'}, 400)
        users = await db['users'].find({'_id': {'$ne': ObjectId(user_id)}}, {'password': 0}).to_list(None)
        for user in users:
            user['_id'] = str(user['_id'])
        return (users, 200)
    except Exception as e:
        print(f'Error in get_all_contacts: {e}')
        return ({'error': 'Server error'}, 500)

async def get_messages_by_user_id(my_id: str, user_to_chat_id: str):
    try:
        db = get_db()
        if not ObjectId.is_valid(my_id) or not ObjectId.is_valid(user_to_chat_id):
            return ({'error': 'Invalid user ID'}, 400)
        my_id_obj = ObjectId(my_id)
        user_to_chat_id_obj = ObjectId(user_to_chat_id)
        messages = await db['messages'].find({'$or': [{'senderId': my_id_obj, 'receiverId': user_to_chat_id_obj}, {'senderId': user_to_chat_id_obj, 'receiverId': my_id_obj}]}).to_list(None)
        for message in messages:
            message['_id'] = str(message['_id'])
            message['senderId'] = str(message['senderId'])
            message['receiverId'] = str(message['receiverId'])
            if isinstance(message.get('createdAt'), datetime):
                message['createdAt'] = message['createdAt'].isoformat()
        return (messages, 200)
    except Exception as e:
        print(f'Error in get_messages_by_user_id: {e}')
        return ({'error': 'Internal server error'}, 500)

async def send_message(sender_id: str, receiver_id: str, ciphertext: str=None, message_type: int=None, session_id: str=None, image: str=None):
    try:
        print(f'[Message] Relaying message from {sender_id} to {receiver_id}')
        db = get_db()
        if not ciphertext and (not image):
            return ({'error': 'Ciphertext or image is required.'}, 400)
        if not ObjectId.is_valid(sender_id) or not ObjectId.is_valid(receiver_id):
            return ({'error': 'Invalid user ID'}, 400)
        sender_id_obj = ObjectId(sender_id)
        receiver_id_obj = ObjectId(receiver_id)
        if sender_id_obj == receiver_id_obj:
            return ({'error': 'Cannot send messages to yourself.'}, 400)
        receiver_exists = await db['users'].find_one({'_id': receiver_id_obj})
        if not receiver_exists:
            return ({'error': 'Receiver not found.'}, 404)
        image_url = None
        if image:
            try:
                image_url = upload_image(image)
            except Exception as e:
                print(f'Error uploading image: {e}')
                return ({'error': 'Failed to upload image'}, 500)
        now = datetime.now()
        new_message = {'senderId': sender_id_obj, 'receiverId': receiver_id_obj, 'ciphertext': ciphertext, 'messageType': message_type, 'sessionId': session_id, 'image': image_url, 'createdAt': now}
        result = await db['messages'].insert_one(new_message)
        if result.inserted_id:
            response_message = {'_id': str(result.inserted_id), 'senderId': str(sender_id_obj), 'receiverId': str(receiver_id_obj), 'ciphertext': ciphertext, 'messageType': message_type, 'sessionId': session_id, 'image': image_url, 'createdAt': now.isoformat()}
            await emit_new_message(receiver_id, response_message)
            return (response_message, 201)
        else:
            return ({'error': 'Failed to store message'}, 400)
    except Exception as e:
        print(f'Error in send_message controller: {e}')
        return ({'error': 'Internal server error'}, 500)

async def get_chat_partners(user_id: str):
    try:
        db = get_db()
        if not ObjectId.is_valid(user_id):
            return ({'error': 'Invalid user ID'}, 400)
        user_id_obj = ObjectId(user_id)
        messages = await db['messages'].find({'$or': [{'senderId': user_id_obj}, {'receiverId': user_id_obj}]}).sort('createdAt', -1).to_list(None)
        chat_partners_map = {}
        for msg in messages:
            if msg['senderId'] == user_id_obj:
                partner_id = msg['receiverId']
            else:
                partner_id = msg['senderId']
            partner_id_str = str(partner_id)
            if partner_id_str not in chat_partners_map:
                chat_partners_map[partner_id_str] = msg.get('createdAt')
        chat_partner_ids_obj = [ObjectId(partner_id) for partner_id in chat_partners_map.keys()]
        chat_partners = await db['users'].find({'_id': {'$in': chat_partner_ids_obj}}, {'password': 0}).to_list(None)
        result = []
        for partner in chat_partners:
            partner_id_str = str(partner['_id'])
            partner['_id'] = partner_id_str
            partner['lastMessageDate'] = chat_partners_map[partner_id_str]
            result.append(partner)
        result.sort(key=lambda x: x.get('lastMessageDate') or datetime.utcnow(), reverse=True)
        return (result, 200)
    except Exception as e:
        print(f'Error in get_chat_partners: {e}')
        return ({'error': 'Internal server error'}, 500)

async def get_chat_partner_ids(user_id: str):
    try:
        db = get_db()
        if not ObjectId.is_valid(user_id):
            return ({'error': 'Invalid user ID'}, 400)
        user_id_obj = ObjectId(user_id)
        messages = await db['messages'].find({'$or': [{'senderId': user_id_obj}, {'receiverId': user_id_obj}]}).to_list(None)
        chat_partner_ids = set()
        for msg in messages:
            if msg['senderId'] == user_id_obj:
                chat_partner_ids.add(str(msg['receiverId']))
            else:
                chat_partner_ids.add(str(msg['senderId']))
        result = sorted(list(chat_partner_ids))
        return (result, 200)
    except Exception as e:
        print(f'Error get_chat_partner_ids failed: {e}')
        return ({'error': 'Internal server error'}, 500)