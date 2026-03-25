from fastapi import APIRouter, Request, Response, Depends, HTTPException, status
from src.controllers.message_controller import (
    get_all_contacts,
    get_messages_by_user_id,
    send_message,
    get_chat_partners,
    get_chat_partner_ids
)
from src.middleware.auth_middleware import protect_route

router = APIRouter(prefix="/api/messages", tags=["messages"])


@router.get("/contacts")
async def get_contacts_route(response: Response, user=Depends(protect_route)):
    """Get all contacts (users) endpoint"""
    try:
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized"
            )
        
        user_id = str(user.get("_id"))
        result, status_code = await get_all_contacts(user_id)
        
        response.status_code = status_code
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_contacts route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/chat-partners")
async def get_chat_partners_route(response: Response, user=Depends(protect_route)):
    """Get all users that the logged-in user has chat history with"""
    try:
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized"
            )
        
        user_id = str(user.get("_id"))
        result, status_code = await get_chat_partners(user_id)
        
        response.status_code = status_code
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_chat_partners route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/chats")
async def get_chats_route(response: Response, user=Depends(protect_route)):
    """Get all users that the logged-in user has chat history with (alias for /chat-partners)"""
    try:
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized"
            )
        
        user_id = str(user.get("_id"))
        result, status_code = await get_chat_partners(user_id)
        
        response.status_code = status_code
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_chats route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/chat-partner-ids")
async def get_chat_partner_ids_route(response: Response, user=Depends(protect_route)):
    """Get list of chat partner IDs for filtering contacts client-side"""
    try:
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized"
            )
        
        user_id = str(user.get("_id"))
        print(f"[Route] chat-partner-ids: user_id={user_id}, user={user}")
        result, status_code = await get_chat_partner_ids(user_id)
        
        response.status_code = status_code
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Route Error] get_chat_partner_ids_route failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/send/{id}")
async def send_message_route(id: str, request: Request, response: Response, user=Depends(protect_route)):
    """Send a message to another user"""
    try:
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized"
            )
        
        data = await request.json()
        text = data.get("text")
        image = data.get("image")
        
        sender_id = str(user.get("_id"))
        result, status_code = await send_message(sender_id, id, text, image)
        
        response.status_code = status_code
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in send_message route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/{id}")
async def get_messages_route(id: str, response: Response, user=Depends(protect_route)):
    """Get all messages between logged-in user and another user"""
    try:
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized"
            )
        
        my_id = str(user.get("_id"))
        result, status_code = await get_messages_by_user_id(my_id, id)
        
        response.status_code = status_code
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_messages route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
