from fastapi import APIRouter, Request, Response, Depends, HTTPException, status
from src.controllers.auth_controller import signup, login, logout, update_profile, check_auth
from src.middleware.auth_middleware import protect_route
from src.models.User import UserCreate, UserLogin, UserUpdate
router = APIRouter(prefix='/api/auth', tags=['auth'])

@router.post('/signup')
async def signup_route(request: Request, response: Response):
    try:
        data = await request.json()
        email = data.get('email')
        fullName = data.get('fullName')
        password = data.get('password')
        result = await signup(email, fullName, password)
        if len(result) == 3:
            (data, status_code, token) = result
        else:
            (data, status_code) = result
            token = None
        if status_code == 201 and token:
            is_https = request.url.scheme == 'https'
            response.set_cookie(key='jwt', value=token, max_age=7 * 24 * 60 * 60, httponly=True, samesite='none' if is_https else 'lax', secure=is_https)
        response.status_code = status_code
        return data
    except Exception as e:
        print(f'Error in signup route: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Internal server error')

@router.post('/login')
async def login_route(request: Request, response: Response):
    try:
        data = await request.json()
        email = data.get('email')
        password = data.get('password')
        result = await login(email, password)
        if len(result) == 3:
            (data, status_code, token) = result
        else:
            (data, status_code) = result
            token = None
        if status_code == 200 and token:
            is_https = request.url.scheme == 'https'
            response.set_cookie(key='jwt', value=token, max_age=7 * 24 * 60 * 60, httponly=True, samesite='none' if is_https else 'lax', secure=is_https)
        response.status_code = status_code
        return data
    except Exception as e:
        print(f'Error in login route: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Internal server error')

@router.post('/logout')
async def logout_route(response: Response):
    try:
        (result, status_code) = await logout()
        response.delete_cookie(key='jwt', httponly=True, samesite='lax', secure=False)
        response.delete_cookie(key='jwt', httponly=True, samesite='none', secure=True)
        response.status_code = status_code
        return result
    except Exception as e:
        print(f'Error in logout route: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Internal server error')

@router.put('/update-profile')
async def update_profile_route(request: Request, response: Response, user=Depends(protect_route)):
    try:
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
        data = await request.json()
        fullName = data.get('fullName')
        profilePic = data.get('profilePic')
        user_id = str(user.get('_id'))
        (result, status_code) = await update_profile(user_id, fullName, profilePic)
        response.status_code = status_code
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error in update_profile route: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Internal server error')

@router.get('/check')
async def check_auth_route(user=Depends(protect_route)):
    try:
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
        return user
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error in check_auth route: {e}')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Internal server error')

@router.get('/fido-callback')
async def fido_callback_route(token: str, request: Request, response: Response):
    from fastapi.responses import RedirectResponse
    from src.lib.config import config
    if not token:
        raise HTTPException(status_code=400, detail='Token is missing')
    host = request.headers.get('host', '')
    if host:
        frontend_host = host.replace(':3000', ':5173')
        scheme = request.url.scheme
        frontend_url = f'{scheme}://{frontend_host}/'
    else:
        frontend_url = f'{config.CLIENT_URL}/'
    redirect_res = RedirectResponse(url=frontend_url, status_code=302)
    is_https = request.url.scheme == 'https'
    redirect_res.set_cookie(key='jwt', value=token, max_age=7 * 24 * 60 * 60, httponly=True, samesite='none' if is_https else 'lax', secure=is_https)
    return redirect_res