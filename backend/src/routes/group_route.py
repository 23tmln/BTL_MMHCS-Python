from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from src.controllers.group_controller import (
    add_group_members,
    create_group,
    get_available_mls_key_packages,
    get_group_messages,
    get_my_groups,
    leave_group,
    remove_group_member,
    save_mls_credential,
    save_mls_handshake,
    save_mls_key_package,
    send_group_message,
)
from src.middleware.auth_middleware import protect_route

router = APIRouter(prefix='/api/groups', tags=['groups'])


@router.post('')
async def create_group_route(request: Request, response: Response, user=Depends(protect_route)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
    data = await request.json()
    result, status_code = await create_group(str(user.get('_id')), data.get('name'), data.get('memberIds', []))
    response.status_code = status_code
    return result


@router.get('')
async def get_my_groups_route(response: Response, user=Depends(protect_route)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
    result, status_code = await get_my_groups(str(user.get('_id')))
    response.status_code = status_code
    return result


@router.post('/mls/credential')
async def save_mls_credential_route(request: Request, response: Response, user=Depends(protect_route)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
    data = await request.json()
    result, status_code = await save_mls_credential(str(user.get('_id')), data)
    response.status_code = status_code
    return result


@router.post('/mls/key-packages')
async def save_mls_key_package_route(request: Request, response: Response, user=Depends(protect_route)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
    data = await request.json()
    result, status_code = await save_mls_key_package(str(user.get('_id')), data)
    response.status_code = status_code
    return result


@router.post('/mls/key-packages/available')
async def get_available_mls_key_packages_route(request: Request, response: Response, user=Depends(protect_route)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
    data = await request.json()
    result, status_code = await get_available_mls_key_packages(str(user.get('_id')), data.get('memberIds', []))
    response.status_code = status_code
    return result


@router.get('/{group_id}/messages')
async def get_group_messages_route(group_id: str, response: Response, user=Depends(protect_route)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
    result, status_code = await get_group_messages(str(user.get('_id')), group_id)
    response.status_code = status_code
    return result


@router.post('/{group_id}/messages')
async def send_group_message_route(group_id: str, request: Request, response: Response, user=Depends(protect_route)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
    data = await request.json()
    result, status_code = await send_group_message(str(user.get('_id')), group_id, data.get('text'), data.get('image'), data.get('ciphertext'), data.get('mlsEpoch'))
    response.status_code = status_code
    return result


@router.post('/{group_id}/members')
async def add_group_members_route(group_id: str, request: Request, response: Response, user=Depends(protect_route)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
    data = await request.json()
    result, status_code = await add_group_members(str(user.get('_id')), group_id, data.get('memberIds', []))
    response.status_code = status_code
    return result


@router.delete('/{group_id}/members/{member_id}')
async def remove_group_member_route(group_id: str, member_id: str, response: Response, user=Depends(protect_route)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
    result, status_code = await remove_group_member(str(user.get('_id')), group_id, member_id)
    response.status_code = status_code
    return result


@router.post('/{group_id}/leave')
async def leave_group_route(group_id: str, response: Response, user=Depends(protect_route)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
    result, status_code = await leave_group(str(user.get('_id')), group_id)
    response.status_code = status_code
    return result


@router.post('/{group_id}/mls/handshakes')
async def save_mls_handshake_route(group_id: str, request: Request, response: Response, user=Depends(protect_route)):
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
    data = await request.json()
    result, status_code = await save_mls_handshake(
        str(user.get('_id')),
        group_id,
        data.get('type'),
        data.get('payload'),
        data.get('epoch'),
    )
    response.status_code = status_code
    return result
