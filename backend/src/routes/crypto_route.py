from fastapi import APIRouter, Request, Response, Depends, HTTPException, status
from src.lib.crypto_client import generate_keys_for_user, get_public_bundle, encrypt_message, decrypt_message
from src.middleware.auth_middleware import protect_route

router = APIRouter(prefix="/api/crypto", tags=["crypto"])


@router.post("/generate-keys")
async def generate_keys_route(request: Request, user=Depends(protect_route)):
    """Generate encryption keys for the authenticated user"""
    try:
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized"
            )

        user_id = str(user.get("_id"))
        result = await generate_keys_for_user(user_id)

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in generate_keys route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/bundle")
async def get_bundle_route(user=Depends(protect_route)):
    """Get public key bundle for the authenticated user"""
    try:
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized"
            )

        user_id = str(user.get("_id"))
        bundle = await get_public_bundle(user_id)

        if not bundle:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bundle not found"
            )

        return bundle

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_bundle route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/encrypt")
async def encrypt_route(request: Request, user=Depends(protect_route)):
    """Encrypt a message"""
    try:
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized"
            )

        data = await request.json()
        sender_id = data.get("from")
        receiver_id = data.get("to")
        plaintext = data.get("plaintext")
        recipient_bundle = data.get("recipientBundle")
        
        if not all([sender_id, receiver_id, plaintext, recipient_bundle]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required fields: from, to, plaintext, recipientBundle"
            )
        
        result = await encrypt_message(sender_id, receiver_id, plaintext, recipient_bundle)

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in encrypt route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/decrypt")
async def decrypt_route(request: Request, user=Depends(protect_route)):
    """Decrypt a message"""
    try:
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized"
            )

        data = await request.json()
        sender_id = data.get("from")
        receiver_id = data.get("to")
        ciphertext = data.get("ciphertext")
        message_type = data.get("messageType")
        session_id = data.get("sessionId")
        
        if not all([sender_id, receiver_id, ciphertext, message_type, session_id]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required fields: from, to, ciphertext, messageType, sessionId"
            )
        
        result = await decrypt_message(sender_id, receiver_id, ciphertext, message_type, session_id)

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in decrypt route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )