import httpx
import os
from typing import Dict, Any, Optional
CRYPTO_SERVICE_URL = os.getenv('CRYPTO_SERVICE_URL', 'http://localhost:4000')

async def generate_keys_for_user(user_id: str) -> Dict[str, Any]:
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f'{CRYPTO_SERVICE_URL}/generate-keys', json={'userId': user_id})
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f'Error generating keys for user {user_id}: {e}')
            raise

async def get_public_bundle(user_id: str) -> Optional[Dict[str, Any]]:
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f'{CRYPTO_SERVICE_URL}/bundle/{user_id}')
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f'Error getting bundle for user {user_id}: {e}')
            raise

async def encrypt_message(sender_id: str, receiver_id: str, plaintext: str, recipient_bundle: Dict[str, Any]) -> Dict[str, Any]:
    async with httpx.AsyncClient() as client:
        try:
            payload = {'from': sender_id, 'to': receiver_id, 'plaintext': plaintext, 'recipientBundle': recipient_bundle}
            response = await client.post(f'{CRYPTO_SERVICE_URL}/encrypt', json=payload)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f'Error encrypting message from {sender_id} to {receiver_id}: {e}')
            raise

async def decrypt_message(sender_id: str, receiver_id: str, ciphertext: str, message_type: str, session_id: str) -> Dict[str, Any]:
    async with httpx.AsyncClient() as client:
        try:
            payload = {'from': sender_id, 'to': receiver_id, 'ciphertext': ciphertext, 'messageType': message_type, 'sessionId': session_id}
            response = await client.post(f'{CRYPTO_SERVICE_URL}/decrypt', json=payload)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f'Error decrypting message: {e}')
            raise

async def backup_user_state(user_id: str, pin: str) -> Dict[str, Any]:
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f'{CRYPTO_SERVICE_URL}/secure-storage/backup', json={'userId': user_id, 'pin': pin})
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f'Error backing up user crypto state for {user_id}: {e}')
            raise

async def restore_user_state(user_id: str, pin: str, encryptedState: str, salt: str, iv: str, authTag: str) -> Dict[str, Any]:
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f'{CRYPTO_SERVICE_URL}/secure-storage/restore', json={'userId': user_id, 'pin': pin, 'encryptedState': encryptedState, 'salt': salt, 'iv': iv, 'authTag': authTag})
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f'Error restoring user crypto state for {user_id}: {e}')
            raise

async def secure_storage_status(user_id: str) -> Dict[str, Any]:
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f'{CRYPTO_SERVICE_URL}/secure-storage/status/{user_id}')
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f'Error checking secure storage status for {user_id}: {e}')
            raise