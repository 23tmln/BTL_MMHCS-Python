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
            # samesite="none" requires secure=True, which requires HTTPS.
            # Fallback to lax and secure=False for local HTTP development.
            is_https = request.url.scheme == "https"
            response.set_cookie(
                key="jwt",
                value=token,
                max_age=7 * 24 * 60 * 60,
                httponly=True,
                samesite="none" if is_https else "lax",
                secure=is_https
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
            # samesite="none" requires secure=True, which requires HTTPS.
            # Fallback to lax and secure=False for local HTTP development.
            is_https = request.url.scheme == "https"
            response.set_cookie(
                key="jwt",
                value=token,
                max_age=7 * 24 * 60 * 60,
                httponly=True,
                samesite="none" if is_https else "lax",
                secure=is_https
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
        
        # Clear JWT cookie
        response.delete_cookie(key="jwt", httponly=True, samesite="lax", secure=False)
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
    Ưu tiên dùng Origin header (do browser gửi, không bị Vite proxy override)
    thay vì Host header (bị changeOrigin đổi thành localhost).
    Fallback chain: Origin → Referer → config.CLIENT_URL

    Khi CLIENT_URL vẫn là localhost (mặc định), callback sẽ tự động
    thay host bằng host thực tế của request để client không bị redirect
    sang localhost:5173.
    """
    from fastapi.responses import RedirectResponse
    from src.lib.config import config
    from urllib.parse import urlparse

    if not token:
        raise HTTPException(status_code=400, detail="Token is missing")

    # 1. Origin header: browser luôn gửi đúng origin gốc, Vite proxy KHÔNG override cái này
    origin = request.headers.get("origin", "")
    if origin:
        # origin có dạng "https://172.17.37.30:5173" → dùng thẳng làm base
        frontend_url = f"{origin}/"
    else:
        # 2. Referer header: thường chứa URL đầy đủ bao gồm path
        referer = request.headers.get("referer", "")
        if referer:
            # Lấy scheme + host từ referer, bỏ path
            from urllib.parse import urlparse
            parsed = urlparse(referer)
            frontend_url = f"{parsed.scheme}://{parsed.netloc}/"
        else:
            # 3. Fallback về CLIENT_URL đã cấu hình trong .env
            client_url = config.CLIENT_URL.strip().rstrip("/")
            parsed_client_url = urlparse(client_url)
            client_host = (parsed_client_url.hostname or "").lower()

            # Nếu CLIENT_URL vẫn là localhost/loopback, tự động dùng host
            # từ request callback (thường là IP server mà client truy cập).
            if client_host in {"localhost", "127.0.0.1", "::1"}:
                request_host = request.url.hostname or ""
                if request_host and request_host.lower() not in {"localhost", "127.0.0.1", "::1"}:
                    scheme = parsed_client_url.scheme or request.url.scheme or "http"
                    port = parsed_client_url.port or 5173
                    host_for_url = f"[{request_host}]" if ":" in request_host else request_host
                    frontend_url = f"{scheme}://{host_for_url}:{port}/"
                else:
                    frontend_url = f"{client_url}/"
            else:
                frontend_url = f"{client_url}/"

    # Xác định cookie settings dựa trên scheme của frontend URL
    is_https = frontend_url.startswith("https://")

    redirect_res = RedirectResponse(url=frontend_url, status_code=302)
    redirect_res.set_cookie(
        key="jwt",
        value=token,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        samesite="none" if is_https else "lax",
        secure=is_https
    )
    return redirect_res
