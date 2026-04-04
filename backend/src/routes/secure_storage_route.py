from fastapi import APIRouter, Request, Depends, HTTPException, status
from src.middleware.auth_middleware import protect_route
from src.controllers.secure_storage_controller import setup_secure_storage, backup_secure_storage, restore_secure_storage, status_secure_storage
router = APIRouter(prefix='/api/secure-storage', tags=['secure_storage'])

@router.post('/setup')
async def setup_route(request: Request, user=Depends(protect_route)):
    try:
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
        body = await request.json()
        pin = body.get('pin')
        if not pin or not isinstance(pin, str) or len(pin) < 4:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='PIN is required and must be at least 4 characters')
        user_id = str(user.get('_id'))
        (result, code) = await setup_secure_storage(user_id, pin)
        if code >= 400:
            raise HTTPException(status_code=code, detail=result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error in secure-storage setup route: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Internal server error')

@router.post('/backup')
async def backup_route(request: Request, user=Depends(protect_route)):
    try:
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
        body = await request.json()
        pin = body.get('pin')
        if not pin or not isinstance(pin, str) or len(pin) < 4:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='PIN is required and must be at least 4 characters')
        user_id = str(user.get('_id'))
        (result, code) = await backup_secure_storage(user_id, pin)
        if code >= 400:
            raise HTTPException(status_code=code, detail=result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error in secure-storage backup route: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Internal server error')

@router.post('/restore')
async def restore_route(request: Request, user=Depends(protect_route)):
    try:
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
        body = await request.json()
        pin = body.get('pin')
        if not pin or not isinstance(pin, str) or len(pin) < 4:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='PIN is required and must be at least 4 characters')
        user_id = str(user.get('_id'))
        (result, code) = await restore_secure_storage(user_id, pin)
        if code >= 400:
            raise HTTPException(status_code=code, detail=result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error in secure-storage restore route: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Internal server error')

@router.get('/status')
async def status_route(user=Depends(protect_route)):
    try:
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
        user_id = str(user.get('_id'))
        (result, code) = await status_secure_storage(user_id)
        if code >= 400:
            raise HTTPException(status_code=code, detail=result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error in secure-storage status route: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Internal server error')