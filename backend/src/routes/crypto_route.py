from fastapi import APIRouter, Request, Depends, HTTPException, status
from src.middleware.auth_middleware import protect_route
from src.lib.db import get_db
router = APIRouter(prefix='/api/keys', tags=['keys'])

@router.post('/upload')
async def upload_keys_route(request: Request, user=Depends(protect_route)):
    try:
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
        user_id = str(user.get('_id'))
        bundle_data = await request.json()
        db = get_db()
        await db['key_bundles'].update_one({'userId': user_id}, {'$set': {'userId': user_id, 'bundle': bundle_data}}, upsert=True)
        print(f'[Keys] Public bundle uploaded for userId: {user_id}')
        return {'message': 'Keys uploaded successfully'}
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error in upload_keys route: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Internal server error')

@router.post('/backup')
async def upload_encrypted_backup(request: Request, user=Depends(protect_route)):
    try:
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
        user_id = str(user.get('_id'))
        body = await request.json()
        encrypted_bundle = body.get('encryptedBundle')
        if not encrypted_bundle:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='encryptedBundle is required')
        db = get_db()
        await db['key_backups'].update_one({'userId': user_id}, {'$set': {'userId': user_id, 'encryptedBundle': encrypted_bundle}}, upsert=True)
        print(f'[Keys] Encrypted backup stored for userId: {user_id}')
        return {'message': 'Encrypted backup stored successfully'}
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error in upload_encrypted_backup: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Internal server error')

@router.get('/backup/me')
async def get_encrypted_backup(user=Depends(protect_route)):
    try:
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
        user_id = str(user.get('_id'))
        db = get_db()
        doc = await db['key_backups'].find_one({'userId': user_id})
        print(f'[Keys] Backup lookup for userId: {user_id} — found: {doc is not None}')
        if not doc or 'encryptedBundle' not in doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='No backup found')
        return {'encryptedBundle': doc['encryptedBundle']}
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error in get_encrypted_backup: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Internal server error')

@router.get('/{target_user_id}')
async def get_bundle_route(target_user_id: str, user=Depends(protect_route)):
    try:
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
        db = get_db()
        key_doc = await db['key_bundles'].find_one({'userId': target_user_id})
        if not key_doc or 'bundle' not in key_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Bundle not found')
        return key_doc['bundle']
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error in get_bundle route: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Internal server error')