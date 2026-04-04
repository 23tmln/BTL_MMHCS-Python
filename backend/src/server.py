import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from src.lib.socket import sio
from socketio import ASGIApp
from src.lib.db import connect_db, disconnect_db
from src.lib.config import config
from src.routes.auth_route import router as auth_router
from src.routes.message_route import router as message_router
from src.routes.crypto_route import router as crypto_router
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info('Starting application...')
    await connect_db()
    logger.info(f'Server will run on port: {config.PORT}')
    yield
    logger.info('Shutting down application...')
    await disconnect_db()
fastapi_app = FastAPI(title='Chatify API', description='Real-time chat application API', version='1.0.0', lifespan=lifespan)
if config.NODE_ENV == 'development':

    @fastapi_app.middleware('http')
    async def add_cors_header(request, call_next):
        origin = request.headers.get('origin')
        if request.method == 'OPTIONS':
            from fastapi import Response
            response = Response()
            if origin:
                response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
            response.status_code = 200
            return response
        response = await call_next(request)
        if origin:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return response
    logger.info('Development CORS: Allowing all origins with credentials dynamically')
else:
    fastapi_app.add_middleware(CORSMiddleware, allow_origins=[config.CLIENT_URL], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
    logger.info(f'Production CORS: Allow only {config.CLIENT_URL}')
fastapi_app.include_router(auth_router)
fastapi_app.include_router(message_router)
fastapi_app.include_router(crypto_router)
uploads_dir = os.path.join(os.path.dirname(__file__), '../uploads')
os.makedirs(uploads_dir, exist_ok=True)
try:
    fastapi_app.mount('/uploads', StaticFiles(directory=uploads_dir), name='uploads')
except Exception as e:
    logger.warning(f'Could not mount uploads directory: {e}')

@fastapi_app.get('/api/health')
async def health_check():
    return {'status': 'ok'}
if config.NODE_ENV == 'production':
    frontend_dist = os.path.join(os.path.dirname(__file__), '../../frontend/dist')
    if os.path.exists(frontend_dist):
        fastapi_app.mount('/', StaticFiles(directory=frontend_dist, html=True), name='static')
app = ASGIApp(sio, fastapi_app)
if __name__ == '__main__':
    import uvicorn
    uvicorn.run('src.server:app', host='0.0.0.0', port=config.PORT, reload=config.NODE_ENV == 'development')