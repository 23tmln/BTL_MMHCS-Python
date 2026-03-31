import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

# Socket.IO setup
from src.lib.socket import sio
from socketio import ASGIApp

from src.lib.db import connect_db, disconnect_db
from src.lib.config import config
from src.routes.auth_route import router as auth_router
from src.routes.message_route import router as message_router
from src.routes.crypto_route import router as crypto_router
from src.routes.secure_storage_route import router as secure_storage_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager"""
    # Startup
    logger.info("Starting application...")
    await connect_db()
    logger.info(f"Server will run on port: {config.PORT}")
    yield
    # Shutdown
    logger.info("Shutting down application...")
    await disconnect_db()


# Create FastAPI app
fastapi_app = FastAPI(
    title="Chatify API",
    description="Real-time chat application API",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware with custom logic
# In development: dynamically allow any origin with credentials
# In production: restrict to CLIENT_URL only
if config.NODE_ENV == "development":
    # Dynamic CORS: Allow any origin with credentials in development
    # This bypasses the wildcard restriction by dynamically mirroring the Origin header
    @fastapi_app.middleware("http")
    async def add_cors_header(request, call_next):
        origin = request.headers.get("origin")
        
        # Handle preflight OPTIONS request BEFORE call_next
        if request.method == "OPTIONS":
            from fastapi import Response
            response = Response()
            if origin:
                response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.status_code = 200
            return response
        
        # Process normal request
        response = await call_next(request)
        
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        
        return response
    
    logger.info("Development CORS: Allowing all origins with credentials dynamically")
else:
    # Production: use standard CORS middleware
    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=[config.CLIENT_URL],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    logger.info(f"Production CORS: Allow only {config.CLIENT_URL}")

# Include routers
fastapi_app.include_router(auth_router)
fastapi_app.include_router(message_router)
fastapi_app.include_router(crypto_router)
fastapi_app.include_router(secure_storage_router)

# Serve uploaded images
uploads_dir = os.path.join(os.path.dirname(__file__), "../uploads")
os.makedirs(uploads_dir, exist_ok=True)
try:
    fastapi_app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
except Exception as e:
    logger.warning(f"Could not mount uploads directory: {e}")

# Health check endpoint
@fastapi_app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}


# Serve frontend in production
if config.NODE_ENV == "production":
    frontend_dist = os.path.join(os.path.dirname(__file__), "../../frontend/dist")
    if os.path.exists(frontend_dist):
        fastapi_app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")


# Wrap FastAPI app with Socket.IO
app = ASGIApp(sio, fastapi_app)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.server:app",
        host="0.0.0.0",
        port=config.PORT,
        reload=config.NODE_ENV == "development"
    )


