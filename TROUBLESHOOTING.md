# 🔧 Troubleshooting Guide

## Backend Setup Issues

### Error: `ModuleNotFoundError: No module named 'src.lib'`

**Cause:** You haven't installed dependencies using `uv sync`.

**Solution:**

```bash
cd backend
uv sync               # Install all dependencies
uv run uvicorn src.server:app --reload --port 3000
```

### Error: `No module named 'dotenv'` or other missing modules

**Cause:** Dependencies not installed or `uv sync` didn't complete properly.

**Solution:**

```bash
cd backend
# Delete old sync files
rm -rf .venv uv.lock

# Reinstall everything fresh
uv sync

# Run again
uv run uvicorn src.server:app --reload --port 3000
```

### Error: `ModuleNotFoundError: No module named 'motor'`

**Cause:** Motor (async MongoDB driver) not installed.

**Solution:**

```bash
cd backend
uv add motor
uv sync
```

### Error: `ConnectionFailure: could not connect to MongoDB`

**Cause:** Invalid MongoDB connection string or MongoDB is down.

**Solution:**

1. Check your `.env` file has correct `MONGO_URI`
2. Verify MongoDB Atlas cluster is running
3. Check IP whitelist in MongoDB Atlas (add `0.0.0.0/0` for development)
4. Test connection string:
   ```bash
   python3
   >>> from motor.motor_asyncio import AsyncIOMotorClient
   >>> import asyncio
   >>> asyncio.run(AsyncIOMotorClient("your_mongo_uri").admin.command('ping'))
   ```

### Error: `Port 3000 already in use`

**Solution:**

```bash
# On Windows - find and kill the process
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# On Mac/Linux
lsof -i :3000
kill -9 <PID>

# Or use different port
uv run uvicorn src.server:app --reload --port 3001
```

---

## Frontend Setup Issues

### Error: `npm: command not found`

**Cause:** Node.js not installed.

**Solution:**

- Download and install from [nodejs.org](https://nodejs.org/)
- Verify: `node --version && npm --version`

### Error: `Cannot find module '@/...'` or similar import errors

**Cause:** Dependencies not installed.

**Solution:**

```bash
cd frontend
npm install       # or npm ci for clean install
npm run dev
```

### Frontend can't connect to Backend API

**Cause:** Backend is not running or port is different.

**Solution:**

1. Make sure backend is running on port 3000:
   ```bash
   cd backend
   uv run uvicorn src.server:app --reload --port 3000
   ```
2. Check `frontend/src/lib/axios.js` has correct API URL
3. Verify CORS is configured in backend

---

## General Issues

### Images not displaying when sending

**Cause:** Frontend can't reach backend `/uploads` directory.

**Solution:**

1. Make sure backend is running
2. Check backend logs for upload errors
3. Verify `backend/uploads/` folder exists (created automatically on first startup)

### Messages not updating in real-time

**Cause:** Socket.IO connection not established.

**Solution:**

1. Open browser DevTools (F12)
2. Check Console for Socket.IO connection errors
3. Verify backend is running and Socket.IO is working:
   ```
   http://localhost:3000/socket.io/?EIO=4&transport=polling
   Should return Socket.IO handshake
   ```

### CORS errors in browser console

**Cause:** Frontend and backend origins don't match CORS whitelist.

**Solution:**
Update `backend/src/server.py` CORS configuration:

```python
allow_origins=[config.CLIENT_URL, "http://localhost:5173", "http://localhost:3000"]
```

---

## Still stuck?

1. Check that all `.env` variables are set correctly
2. Make sure you're running commands in the correct directory
3. Try clearing cache and reinstalling:

   ```bash
   # Backend
   rm -rf .venv && uv sync

   # Frontend
   rm -rf node_modules && npm install
   ```

4. Check that Python 3.9+ is installed: `python3 --version`
5. Check that uv is installed: `uv --version`
