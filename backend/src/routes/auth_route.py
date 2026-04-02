from fastapi import APIRouter, Request, Response, Depends, HTTPException, status
from src.controllers.auth_controller import (
    signup,
    login,
    logout,
    update_profile,
    check_auth
)
from src.middleware.auth_middleware import protect_route
from src.models.User import UserCreate, UserLogin, UserUpdate

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup")
async def signup_route(request: Request, response: Response):
    """User signup endpoint"""
    try:
        data = await request.json()
        email = data.get("email")
        fullName = data.get("fullName")
        password = data.get("password")
        
        result = await signup(email, fullName, password)
        
        # Controller returns (data, status) on error, (data, status, token) on success
        if len(result) == 3:
            data, status_code, token = result
        else:
            data, status_code = result
            token = None
        
        if status_code == 201 and token:
            # Set JWT cookie
            # samesite="none" is required because the frontend (Vite HTTPS proxy)
            # and backend (HTTP) are cross-origin. SameSite=None requires Secure=True.
            response.set_cookie(
                key="jwt",
                value=token,
                max_age=7 * 24 * 60 * 60,
                httponly=True,
                samesite="none",
                secure=True
            )
        
        response.status_code = status_code
        return data
        
    except Exception as e:
        print(f"Error in signup route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/login")
async def login_route(request: Request, response: Response):
    """User login endpoint"""
    try:
        data = await request.json()
        email = data.get("email")
        password = data.get("password")
        
        result = await login(email, password)
        
        # Controller returns (data, status) on error, (data, status, token) on success
        if len(result) == 3:
            data, status_code, token = result
        else:
            data, status_code = result
            token = None
        
        if status_code == 200 and token:
            # Set JWT cookie
            # samesite="none" is required because the frontend (Vite HTTPS proxy)
            # and backend (HTTP) are cross-origin. SameSite=None requires Secure=True.
            response.set_cookie(
                key="jwt",
                value=token,
                max_age=7 * 24 * 60 * 60,
                httponly=True,
                samesite="none",
                secure=True
            )
        
        response.status_code = status_code
        return data
        
    except Exception as e:
        print(f"Error in login route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/logout")
async def logout_route(response: Response):
    """User logout endpoint"""
    try:
        result, status_code = await logout()
        
        # Clear JWT cookie — must specify same samesite/secure attrs as when it was set
        # otherwise some browsers won't actually delete it
        response.delete_cookie(key="jwt", httponly=True, samesite="none", secure=True)
        
        response.status_code = status_code
        return result
        
    except Exception as e:
        print(f"Error in logout route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.put("/update-profile")
async def update_profile_route(request: Request, response: Response, user=Depends(protect_route)):
    """Update user profile endpoint"""
    try:
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized"
            )
        
        data = await request.json()
        fullName = data.get("fullName")
        profilePic = data.get("profilePic")
        
        user_id = str(user.get("_id"))
        result, status_code = await update_profile(user_id, fullName, profilePic)
        
        response.status_code = status_code
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in update_profile route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/check")
async def check_auth_route(user=Depends(protect_route)):
    """Check if user is authenticated"""
    try:
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized"
            )
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in check_auth route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/fido-callback")
async def fido_callback_route(token: str, request: Request, response: Response):
    """Callback from FIDO desktop app — sets JWT cookie and redirects to frontend.
    Auto-detects the frontend URL from the request Host header so it works
    on any IP (localhost, LAN IP, etc.) without hardcoding.
    """
    from fastapi.responses import RedirectResponse
    from src.lib.config import config

    if not token:
        raise HTTPException(status_code=400, detail="Token is missing")

    # Try to build frontend URL from the request's Host header
    # This way it works with any IP (localhost, 172.17.x.x, etc.)
    host = request.headers.get("host", "")  # e.g. "172.17.41.222:3000"
    if host:
        # Replace backend port (3000) with frontend port (5173)
        frontend_host = host.replace(":3000", ":5173")
        scheme = request.url.scheme  # "http" or "https"
        frontend_url = f"{scheme}://{frontend_host}/"
    else:
        # Fallback to configured CLIENT_URL
        frontend_url = f"{config.CLIENT_URL}/"

    redirect_res = RedirectResponse(url=frontend_url, status_code=302)
    redirect_res.set_cookie(
        key="jwt",
        value=token,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        samesite="none",
        secure=True
    )
    return redirect_res
