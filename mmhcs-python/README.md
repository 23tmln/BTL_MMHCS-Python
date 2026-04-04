# 🖥️ Chatify Desktop Client (Python & PyQt6)

This subdirectory contains the Python-based Desktop Client for the **Chatify** secure messaging ecosystem. It serves as a high-security entry point, leveraging hardware-backed authentication (Passkeys) and secondary 2FA layers before granting access to the encrypted messaging environment.

## 🌟 Key Features

- **PyQt6 Luxury UI**: A sleek, modern "Black & White" themed interface designed for high-end user experience.
- **Passkey Authentication (FIDO2/WebAuthn)**: Professional-grade passwordless security. Uses local authenticators (Windows Hello, TouchID, or Security Keys) to eliminate phishing risks.
- **Mandatory 2FA (TOTP)**: Automatic setup of Two-Factor Authentication via QR Code (compatible with Google Authenticator, Authy, etc.) during the first login.
- **Crypto Integration**: Prepared for Pysignal (Signal Protocol) for native end-to-end encryption handling within the Python environment.
- **Hybrid Bridge**: Authenticates users locally and securely bridges them to the web-based chat interface upon success.

## 🛠️ Technology Stack

- **GUI Framework**: [PyQt6](https://www.riverbankcomputing.com/software/pyqt/)
- **Authentication**: `webauthn`, `fido2`, `pyotp`
- **Networking**: `requests` (REST API communication with FastAPI Backend)
- **Security**: `cryptography`, `PyJWT`
- **Other**: `qrcode` (for 2FA setup), `python-dotenv` (configuration)

## 🚀 Getting Started

### Prerequisites

- Python 3.9 or higher
- Access to the Chatify Backend server (ensure the backend is running)

### Installation

1. Navigate to this directory:
   ```bash
   cd mmhcs-python
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure Environment Variables:
   Create a `.env` file based on `.env.example`:
   ```env
   CHATIFY_BACKEND_URL=http://your-backend-ip:3000
   CHATIFY_CLIENT_URL=http://your-frontend-ip:5173
   ```

### Running the Client

Start the desktop login interface:
```bash
python login_ui.py
```

## 📁 Project Structure

- `login_ui.py`: The main entry point and GUI implementation.
- `passkey_client.py` & `passkey_server.py`: Logic for FIDO2 registration and authentication ceremonies.
- `credential_store.py`: Secure local management of user credentials, TOTP secrets, and passkey data.
- `pysignal/`: Implementation of the Signal Protocol in Python for E2EE message processing.
- `migrate_to_mongo.py`: Utility script for synchronizing local credentials to the central database.

## 🔐 Security Architecture

1. **API Handshake**: Validates basic user existence via the Backend REST API.
2. **Passkey Ceremony**: Triggers the hardware-backed WebAuthn challenge.
3. **2FA Verification**: If a TOTP secret exists, the user must provide a 6-digit code.
4. **Session Handoff**: Upon full verification, the client generates a secure handoff to the web client.

---
*Part of the BTL Mật Mã Học Cơ Sở (Basic Cryptography Project)*
