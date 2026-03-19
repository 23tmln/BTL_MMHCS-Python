# ✅ Chatify Setup Checklist

Use this checklist to ensure everything is properly set up.

## Prerequisites Installation

- [ ] **Python 3.9 or higher installed**

  ```bash
  python3 --version
  ```

  If not: Download from [python.org](https://www.python.org/downloads/)

- [ ] **Node.js 16+ and npm installed**

  ```bash
  node --version
  npm --version
  ```

  If not: Download from [nodejs.org](https://nodejs.org/)

- [ ] **uv package manager installed**

  ```bash
  uv --version
  ```

  If not: Run `pip install uv`

- [ ] **MongoDB Atlas account created**
  - Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
  - Create a free account
  - Create a cluster
  - Get connection string (URI)

## Repository Setup

- [ ] **Clone the repository**

  ```bash
  git clone <repository-url>
  cd chatify
  ```

- [ ] **Backend environment file created**

  ```bash
  cd backend
  cp .env.example .env
  ```

- [ ] **Fill in `.env` with your values:**
  - [ ] `MONGO_URI` = Your MongoDB connection string from Atlas
  - [ ] `JWT_SECRET` = Any random string (change in production!)
  - [ ] `CLIENT_URL` = `http://localhost:5173`
  - [ ] Optional: `RESEND_API_KEY` for email functionality

  Example `.env`:

  ```
  PORT=3000
  MONGO_URI=mongodb+srv://username:password@cluster0.mongodb.net/chatapp_db
  JWT_SECRET=my_super_secret_jwt_key_12345
  NODE_ENV=development
  CLIENT_URL=http://localhost:5173
  ```

## Backend Setup

- [ ] **Install Python dependencies**

  ```bash
  cd backend
  uv sync
  ```

- [ ] **Verify backend can start**

  ```bash
  uv run uvicorn src.server:app --reload --port 3000
  ```

  You should see:

  ```
  INFO:     Uvicorn running on http://127.0.0.1:3000
  Application startup complete.
  ```

- [ ] **Press Ctrl+C to stop the backend**

## Frontend Setup

- [ ] **Install Node dependencies**

  ```bash
  cd frontend
  npm install
  ```

- [ ] **Verify frontend can start**

  ```bash
  npm run dev
  ```

  You should see:

  ```
  VITE v... ready in ... ms
  ➜  Local:   http://localhost:5173/
  ```

- [ ] **Press Ctrl+C to stop the frontend**

## Running Both Services

Choose one method:

### Option 1: Two Terminal Windows (Recommended for development)

Terminal 1:

```bash
cd backend
uv run uvicorn src.server:app --reload --port 3000
```

Terminal 2:

```bash
cd frontend
npm run dev
```

### Option 2: Automated Startup Script

**Windows:**

```bash
dev.bat
```

**Mac/Linux:**

```bash
chmod +x dev.sh
./dev.sh
```

## Testing the Application

- [ ] **Open browser to frontend:**
      Navigate to [http://localhost:5173](http://localhost:5173)

- [ ] **Backend is accessible:**
      Visit [http://localhost:3000/api/health](http://localhost:3000/api/health)
      Should return: `{"status":"ok"}`

- [ ] **Create an account:**
  - Go to Sign Up page
  - Enter email, password, full name
  - Click Sign Up
  - Should redirect to chat page after login

- [ ] **Test real-time messaging:**
  - Open two browser windows/tabs
  - Log in with different accounts
  - Send messages between them
  - Messages should appear instantly without page reload

- [ ] **Test image uploads:**
  - Send an image to another user
  - Image should display immediately in chat

## Database Verification

- [ ] **Check MongoDB for user data:**
  - Go to MongoDB Atlas
  - Select your cluster
  - Go to Collections tab
  - You should see `users` and `messages` collections

## Common Issues

If you encounter errors, check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

Key things to verify:

- [ ] Backend is running on port 3000
- [ ] Frontend is running on port 5173
- [ ] `.env` file exists in backend folder with correct values
- [ ] MongoDB connection string is correct
- [ ] All dependencies installed with `uv sync` and `npm install`

## Environment Variables Confirmed

- [ ] `MONGO_URI` → Database connection
- [ ] `JWT_SECRET` → Token signing
- [ ] `CLIENT_URL` → CORS origin
- [ ] `PORT` → Backend port (3000)
- [ ] `NODE_ENV` → development

---

**🎉 All checks passed? Your Chatify instance is ready to use!**

Need help? Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
