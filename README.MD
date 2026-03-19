<h1 align="center">✨ Full-Stack Chat App with Auth & Emails ✨</h1>

![Demo App](/frontend/public/screenshot-for-readme.png)

Highlights:

- 🔐 Custom JWT Authentication (no 3rd-party auth)
- ⚡ Real-time Messaging via Socket.io
- 🟢 Online/Offline Presence Indicators
- 🔔 Notification & Typing Sounds (with toggle)
- 📨 Welcome Emails on Signup (Resend)
- 🗂️ Image Uploads (Local storage)
- 🧰 Backend: FastAPI + Python
- 🧱 MongoDB for Data Persistence
- 🎨 Beautiful UI with React, Tailwind CSS & DaisyUI
- 🧠 Zustand for State Management
- 🧑‍💻 Git & GitHub Workflow (branches, PRs, merges)
- 🚀 Easy Deployment

---

## 🚀 Quick Setup Guide

### Prerequisites

- **Python 3.9+** (for backend)
- **Node.js 16+** (for frontend)
- **uv** package manager for Python ([install uv](https://docs.astral.sh/uv/getting-started/installation/))
- **MongoDB Atlas** account (free tier available)

### 1️⃣ Clone the Repository

```bash
git clone <repository-url>
cd chatify
```

### 2️⃣ Backend Setup (Python + FastAPI)

```bash
cd backend

# Install dependencies using uv
uv sync

# Create .env file with your configuration
cp .env.example .env  # or create .env manually with values below

# Run the server
uv run uvicorn src.server:app --reload --port 3000
```

Backend will run on: **http://localhost:3000**

### 3️⃣ Frontend Setup (React + Vite)

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend will run on: **http://localhost:5173**

---

## ⚡ Quick Start (Automated)

### Windows Users

```bash
# Double-click or run:
dev.bat
```

### Mac/Linux Users

```bash
# Make script executable first (one-time)
chmod +x dev.sh

# Run:
./dev.sh
```

The startup script will:

- Check prerequisites (Python, Node.js, uv)
- Start backend on port 3000
- Start frontend on port 5173
- Open both services ready to use!

---

## 🧪 .env Configuration

### Backend (`/backend/.env`)

```bash
PORT=3000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/chatapp_db

NODE_ENV=development

JWT_SECRET=your_secure_jwt_secret_change_this_in_production

RESEND_API_KEY=your_resend_api_key (optional for email)
EMAIL_FROM=noreply@chatify.com (optional)
EMAIL_FROM_NAME=Chatify (optional)

CLIENT_URL=http://localhost:5173

# Optional: Arcjet for rate limiting
ARCJET_KEY=your_arcjet_key
ARCJET_ENV=development
```

### Frontend (`/frontend/.env.local`)

```bash
# Frontend uses http://localhost:3000/api as API base URL
# No additional .env configuration needed for development
```

---

## 🔧 Running the Application

### Terminal 1: Backend (Python FastAPI)

```bash
cd backend
uv run uvicorn src.server:app --reload --port 3000
```

### Terminal 2: Frontend (React Vite)

```bash
cd frontend
npm run dev
```

---

## 🆘 Troubleshooting

If you encounter any issues during setup, check the [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) guide:

**Common issues:**

- ❌ `ModuleNotFoundError: No module named 'src.lib'` → Run `uv sync`
- ❌ `Port 3000 already in use` → Kill existing process or use different port
- ❌ `Cannot connect to MongoDB` → Check connection string and IP whitelist
- ❌ Images not displaying → Ensure backend is running on port 3000
- ❌ Real-time messages not working → Check Socket.IO connection in browser console

👉 **Full troubleshooting guide:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## 📁 Project Structure

```
chatify/
├── backend/                   # Python FastAPI backend
│   ├── src/
│   │   ├── server.py         # FastAPI app + Socket.IO
│   │   ├── controllers/      # Business logic
│   │   ├── routes/           # API endpoints
│   │   ├── models/           # Pydantic models
│   │   ├── middleware/       # Auth middleware
│   │   ├── lib/              # Utils (Socket.IO, DB, config)
│   │   └── emails/           # Email templates
│   ├── uploads/              # Local image uploads
│   ├── .env.example          # Example environment variables
│   └── pyproject.toml        # Python dependencies
│
└── frontend/                  # React Vite frontend
    ├── src/
    │   ├── components/       # React components
    │   ├── pages/            # Page components
    │   ├── hooks/            # Custom hooks
    │   ├── store/            # Zustand stores
    │   └── lib/              # Utilities
    ├── public/               # Static assets
    └── package.json          # NPM dependencies
```

---

## 🌐 Environment Variables Reference

| Variable         | Backend | Frontend | Description                          |
| ---------------- | ------- | -------- | ------------------------------------ |
| `PORT`           | ✅      | -        | Backend server port (default: 3000)  |
| `MONGO_URI`      | ✅      | -        | MongoDB connection string            |
| `JWT_SECRET`     | ✅      | -        | Secret key for JWT tokens            |
| `CLIENT_URL`     | ✅      | -        | Frontend URL for CORS                |
| `NODE_ENV`       | ✅      | -        | Environment (development/production) |
| `RESEND_API_KEY` | ✅      | -        | Email service API key (optional)     |

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Commit changes: `git commit -m "Add my feature"`
3. Push to branch: `git push origin feature/my-feature`
4. Open a Pull Request

---

## 📝 License

This project is open source and available under the MIT License.
