from bson import ObjectId
from datetime import datetime
from src.lib.db import get_db
from src.lib.cloudinary import upload_image
from src.lib.socket import get_receiver_socket_id, emit_new_message, emit_online_users
from src.lib.crypto_client import generate_keys_for_user, get_public_bundle, encrypt_message, decrypt_message


async def get_all_contacts(user_id: str):
    """Get all users except the logged-in user"""
    try:
        db = get_db()
        
        if not ObjectId.is_valid(user_id):
            return {"error": "Invalid user ID"}, 400
        
        # Find all users except the logged-in user, excluding password
        users = await db["users"].find(
            {"_id": {"$ne": ObjectId(user_id)}},
            {"password": 0}
        ).to_list(None)
        
        # Convert ObjectId to string
        for user in users:
            user["_id"] = str(user["_id"])
        
        return users, 200
        
    except Exception as e:
        print(f"Error in get_all_contacts: {e}")
        return {"error": "Server error"}, 500


async def get_messages_by_user_id(my_id: str, user_to_chat_id: str):
    """Get all messages between two users"""
    try:
        db = get_db()
        
        # Validate IDs
        if not ObjectId.is_valid(my_id) or not ObjectId.is_valid(user_to_chat_id):
            return {"error": "Invalid user ID"}, 400
        
        my_id_obj = ObjectId(my_id)
        user_to_chat_id_obj = ObjectId(user_to_chat_id)
        
        # Find messages where users are sender or receiver
        messages = await db["messages"].find({
            "$or": [
                {"senderId": my_id_obj, "receiverId": user_to_chat_id_obj},
                {"senderId": user_to_chat_id_obj, "receiverId": my_id_obj}
            ]
        }).to_list(None)
        
        # Convert ObjectIds to strings and decrypt messages
        for message in messages:
            message["_id"] = str(message["_id"])
            message["senderId"] = str(message["senderId"])
            message["receiverId"] = str(message["receiverId"])

            # Use cached plaintext if already decrypted in DB
            if message.get("decryptedText"):
                message["text"] = message["decryptedText"]
                continue

            # Decrypt ciphertext if present
            if message.get("ciphertext") and message.get("messageType") and message.get("sessionId"):
                try:
                    decrypt_result = await decrypt_message(
                        message["senderId"],
                        message["receiverId"],
                        message["ciphertext"],
                        message["messageType"],
                        message["sessionId"]
                    )
                    message["text"] = decrypt_result["plaintext"]

                    if message["text"] == "[Message already decrypted; using cached value]":
                        # Try to read again in case another concurrent request just saved it
                        fresh_msg = await db["messages"].find_one({"_id": ObjectId(message["_id"])})
                        if fresh_msg and fresh_msg.get("decryptedText"):
                            message["text"] = fresh_msg["decryptedText"]
                    else:
                        # persist the successful plaintext so repeated query does not trigger libsignal one-time-key races
                        try:
                            await db["messages"].update_one(
                                {"_id": ObjectId(message["_id"])},
                                {"$set": {"decryptedText": message["text"]}}
                            )
                        except Exception as upderr:
                            print(f"Warning: could not persist decryptedText for {message['_id']}: {upderr}")

                except Exception as e:
                    print(f"Error decrypting message {message['_id']}: {e}")
                    message["text"] = "[Decryption failed]"
            else:
                message["text"] = message.get("ciphertext", "")  # Fallback
            
            # Convert datetime objects to ISO strings
            if isinstance(message.get("createdAt"), datetime):
                message["createdAt"] = message["createdAt"].isoformat()
        
        return messages, 200
        
    except Exception as e:
        print(f"Error in get_messages_by_user_id: {e}")
        return {"error": "Internal server error"}, 500


async def send_message(sender_id: str, receiver_id: str, text: str = None, image: str = None):
    """Send a message from one user to another"""
    try:
        print(f"[Message] Sending message from {sender_id} to {receiver_id}")
        db = get_db()
        
        # Validate input
        if not text and not image:
            return {"error": "Text or image is required."}, 400
        
        # Validate IDs
        if not ObjectId.is_valid(sender_id) or not ObjectId.is_valid(receiver_id):
            return {"error": "Invalid user ID"}, 400
        
        sender_id_obj = ObjectId(sender_id)
        receiver_id_obj = ObjectId(receiver_id)
        
        # Check if user is trying to send message to themselves
        if sender_id_obj == receiver_id_obj:
            return {"error": "Cannot send messages to yourself."}, 400
        
        # Check if receiver exists
        receiver_exists = await db["users"].find_one({"_id": receiver_id_obj})
        if not receiver_exists:
            return {"error": "Receiver not found."}, 404
        
        # Handle image upload if provided
        image_url = None
        if image:
            try:
                image_url = upload_image(image)
            except Exception as e:
                print(f"Error uploading image: {e}")
                return {"error": "Failed to upload image"}, 500
        
        # Encrypt text using crypto service
        encrypt_result = None
        if text:
            try:
                # Get receiver's public bundle
                bundle_response = await get_public_bundle(receiver_id)
                if not bundle_response:
                    return {"error": "Receiver has no encryption keys. Please ask them to refresh."}, 400

                recipient_bundle = bundle_response["bundle"]

                # Encrypt message
                encrypt_result = await encrypt_message(sender_id, receiver_id, text, recipient_bundle)

            except Exception as e:
                print(f"Error encrypting message: {e}")
                return {"error": "Failed to encrypt message"}, 500
        
        # Create new message with encrypted data
        now = datetime.now()
        new_message = {
            "senderId": sender_id_obj,
            "receiverId": receiver_id_obj,
            "ciphertext": encrypt_result["ciphertext"] if encrypt_result else None,
            "messageType": encrypt_result["messageType"] if encrypt_result else None,
            "sessionId": encrypt_result["sessionId"] if encrypt_result else None,
            "image": image_url,
            "createdAt": now
        }
        
        result = await db["messages"].insert_one(new_message)
        
        if result.inserted_id:
            # Convert for response (return plaintext to sender)
            response_message = {
                "_id": str(result.inserted_id),
                "senderId": str(sender_id_obj),
                "receiverId": str(receiver_id_obj),
                "text": text,  # Return original plaintext to sender
                "image": image_url,
                "createdAt": now.isoformat()
            }
            
            # Emit message to receiver in real-time if they're connected
            await emit_new_message(receiver_id, response_message)
            
            return response_message, 201
        else:
            return {"error": "Failed to send message"}, 400
            
    except Exception as e:
        print(f"Error in send_message controller: {e}")
        return {"error": "Internal server error"}, 500


async def get_chat_partners(user_id: str):
    """Get all users that the logged-in user has messages with, sorted by last message date"""
    try:
        db = get_db()
        
        if not ObjectId.is_valid(user_id):
            return {"error": "Invalid user ID"}, 400
        
        user_id_obj = ObjectId(user_id)
        
        # Find all messages where the user is sender or receiver
        messages = await db["messages"].find({
            "$or": [
                {"senderId": user_id_obj},
                {"receiverId": user_id_obj}
            ]
        }).sort("createdAt", -1).to_list(None)
        
        # Extract unique chat partner IDs with last message date
        chat_partners_map = {}  # {partner_id: last_message_date}
        for msg in messages:
            if msg["senderId"] == user_id_obj:
                partner_id = msg["receiverId"]
            else:
                partner_id = msg["senderId"]
            
            partner_id_str = str(partner_id)
            if partner_id_str not in chat_partners_map:
                chat_partners_map[partner_id_str] = msg.get("createdAt")
        
        # Convert to ObjectId list for query
        chat_partner_ids_obj = [ObjectId(partner_id) for partner_id in chat_partners_map.keys()]
        
        # Get chat partners, excluding password
        chat_partners = await db["users"].find(
            {"_id": {"$in": chat_partner_ids_obj}},
            {"password": 0}
        ).to_list(None)
        
        # Convert ObjectIds to strings and add last message date
        result = []
        for partner in chat_partners:
            partner_id_str = str(partner["_id"])
            partner["_id"] = partner_id_str
            partner["lastMessageDate"] = chat_partners_map[partner_id_str]
            result.append(partner)
        
        # Sort by last message date (newest first)
        result.sort(key=lambda x: x.get("lastMessageDate") or datetime.utcnow(), reverse=True)
        
        print(f"[Message] get_chat_partners for user {user_id}: found {len(result)} chat partners")
        return result, 200
        
    except Exception as e:
        print(f"Error in get_chat_partners: {e}")
        return {"error": "Internal server error"}, 500


async def get_chat_partner_ids(user_id: str):
    """Get list of user IDs that have chat history with the logged-in user"""
    try:
        print(f"[Controller] get_chat_partner_ids called with user_id={user_id}")
        db = get_db()
        
        if not ObjectId.is_valid(user_id):
            print(f"[Controller] Invalid user ID: {user_id}")
            return {"error": "Invalid user ID"}, 400
        
        user_id_obj = ObjectId(user_id)
        print(f"[Controller] user_id_obj={user_id_obj}")
        
        # Find all messages where the user is sender or receiver
        messages = await db["messages"].find({
            "$or": [
                {"senderId": user_id_obj},
                {"receiverId": user_id_obj}
            ]
        }).to_list(None)
        
        print(f"[Controller] Found {len(messages)} messages")
        
        # Extract unique chat partner IDs
        chat_partner_ids = set()
        for msg in messages:
            if msg["senderId"] == user_id_obj:
                chat_partner_ids.add(str(msg["receiverId"]))
            else:
                chat_partner_ids.add(str(msg["senderId"]))
        
        result = sorted(list(chat_partner_ids))
        print(f"[Controller] get_chat_partner_ids for user {user_id}: found {len(result)} chat partners: {result}")
        return result, 200
        
    except Exception as e:
        print(f"[Controller Error] get_chat_partner_ids failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": f"Internal server error: {str(e)}"}, 500
