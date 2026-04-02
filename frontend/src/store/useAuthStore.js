import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import {
  hasKeysForUser,
  generateKeysForUser,
  getPublicBundleForUser,
  exportFullPrivateBundle,
  importFullPrivateBundle,
} from "../lib/signalHelper";
import { encryptPrivateBundle, decryptPrivateBundle } from "../lib/cryptoBackup";
import { clearAllCryptoState } from "../lib/secureStore";

const getSocketUrl = () => {
  // Always connect to same origin — Vite dev proxy forwards /socket.io to backend
  return window.location.origin;
};

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  isSigningUp: false,
  isLoggingIn: false,
  socket: null,
  onlineUsers: [],
  isSignalConfigured: false,

  // Passphrase modal state
  isPassphraseModalOpen: false,
  passphraseMode: "setup", // "setup" | "restore"

  // --- PASSPHRASE BACKUP / RESTORE ---

  /**
   * Encrypt the current full private bundle with a passphrase and upload to server.
   * Called after user creates/updates their passphrase.
   */
  backupKeysWithPassphrase: async (passphrase, quiet = false) => {
    const { authUser } = get();
    if (!authUser) return;
    try {
      const bundle = await exportFullPrivateBundle(authUser._id);
      const encryptedBundle = await encryptPrivateBundle(bundle, passphrase);
      await axiosInstance.post("/keys/backup", { encryptedBundle });
      
      if (!quiet) {
        toast.success("🔐 Keys backed up securely!");
        set({ isPassphraseModalOpen: false });
        console.log("[E2EE] Keys backed up with passphrase");
        // Save passphrase locally for transparent auto-backups on new messages
        const { saveKey } = await import("../lib/secureStore");
        await saveKey("auto_backup_passphrase", passphrase);
      }
    } catch (e) {
      if (!quiet) {
        console.error("[E2EE] Backup failed:", e);
        toast.error("Failed to backup keys: " + e.message);
      } else {
        console.warn("[E2EE] Auto-backup failed silently:", e.message);
      }
    }
  },

  autoBackupKeys: async () => {
    try {
      const { getKey } = await import("../lib/secureStore");
      const passphrase = await getKey("auto_backup_passphrase");
      if (passphrase) {
        // Run quietly
        await get().backupKeysWithPassphrase(passphrase, true);
      }
    } catch (e) {
      console.warn("[E2EE] Could not trigger auto-backup", e);
    }
  },

  /**
   * Download encrypted bundle from server and decrypt with passphrase.
   * Restores all private keys + session state + message cache to IndexedDB.
   * After restore, automatically reloads the currently open chat so cached
   * messages appear immediately without user having to navigate away.
   */
  restoreKeysWithPassphrase: async (passphrase) => {
    const { authUser } = get();
    if (!authUser) return;
    try {
      const res = await axiosInstance.get("/keys/backup/me");
      const { encryptedBundle } = res.data;
      const bundle = await decryptPrivateBundle(encryptedBundle, passphrase);
      // importFullPrivateBundle now also restores the message plaintext cache
      await importFullPrivateBundle(bundle);

      // Upload public bundle so server has fresh public keys
      const publicBundle = await getPublicBundleForUser(authUser._id);
      await axiosInstance.post("/keys/upload", publicBundle);

      set({ isSignalConfigured: true, isPassphraseModalOpen: false });
      toast.success("✅ Keys restored! Lịch sử tin nhắn đã được khôi phục.");
      console.log("[E2EE] Keys restored from passphrase backup");
      
      // Save passphrase locally for transparent auto-backups on new messages
      const { saveKey } = await import("../lib/secureStore");
      await saveKey("auto_backup_passphrase", passphrase);

      // Reload the currently open chat so cached messages show up immediately
      try {
        const { useChatStore } = await import("./useChatStore");
        const { selectedUser, getMessagesByUserId } = useChatStore.getState();
        if (selectedUser) {
          await getMessagesByUserId(selectedUser._id);
        }
      } catch (reloadErr) {
        console.warn("[E2EE] Could not auto-reload chat after restore:", reloadErr);
      }
    } catch (e) {
      console.error("[E2EE] Restore failed:", e);
      if (e.message.includes("wrong passphrase") || e.message.includes("Decryption failed")) {
        toast.error("❌ Sai passphrase! Vui lòng thử lại.");
      } else if (e.response?.status === 404) {
        toast.error("Không tìm thấy backup trên server.");
      } else {
        toast.error("Khôi phục thất bại: " + e.message);
      }
    }
  },

  /**
   * Skip restore — generate fresh keys. Old messages will be unreadable.
   * This does a FULL wipe including message cache (user accepts losing history).
   */
  skipRestoreAndGenerateNewKeys: async () => {
    const { authUser } = get();
    if (!authUser) return;
    // preserveMessageCache = false → full wipe, user consciously chooses to lose old messages
    await clearAllCryptoState(false);
    const publicBundle = await generateKeysForUser(authUser._id);
    await axiosInstance.post("/keys/upload", publicBundle);
    set({ isSignalConfigured: true, isPassphraseModalOpen: false, passphraseMode: "setup" });
    toast("🆕 New keys generated. Tin nhắn cũ không thể đọc được.", { icon: "⚠️" });
  },

  openManualBackup: () => {
    set({ isPassphraseModalOpen: true, passphraseMode: "setup" });
  },

  closePassphraseModal: () => {
    set({ isPassphraseModalOpen: false });
  },

  // --- IDENTITY SETUP ---

  checkLocalIdentity: async (userId) => {
    try {
      const hasKeys = await hasKeysForUser(userId);

      if (hasKeys) {
        // Keys exist locally — just sync public bundle to server and continue
        console.log("[E2EE] Local keys found. Syncing public bundle...");
        try {
          const publicBundle = await getPublicBundleForUser(userId);
          await axiosInstance.post("/keys/upload", publicBundle);
          console.log("[E2EE] Public bundle uploaded successfully");
          set({ isSignalConfigured: true });
          return;
        } catch (bundleErr) {
          // This happens when local keys exist but are INCOMPLETE (e.g. missing signature —
          // keys generated before the signature-save fix was applied).
          // Treat it the same as "no local keys": check for server backup first.
          console.warn("[E2EE] Local keys incomplete or corrupt:", bundleErr.message,
            "— falling through to backup check.");
          // Clear broken keys/sessions but PRESERVE message cache so cached
          // plaintexts survive — user can still read old messages after restore.
          const { clearAllCryptoState } = await import("../lib/secureStore.js");
          await clearAllCryptoState(true); // preserveMessageCache = true
        }
      }

      // No local keys (or they were just cleared) — check if server has an encrypted backup
      console.log("[E2EE] No valid local keys. Checking server for encrypted backup...");
      try {
        await axiosInstance.get("/keys/backup/me");
        // Backup exists → prompt user to restore with passphrase
        console.log("[E2EE] Backup found on server. Prompting restore...");
        set({ isPassphraseModalOpen: true, passphraseMode: "restore" });
      } catch (e) {
        if (e.response?.status === 404) {
          // No backup either — fresh start, generate new keys
          console.log("[E2EE] No backup found. Generating fresh keys...");
          const publicBundle = await generateKeysForUser(userId);
          await axiosInstance.post("/keys/upload", publicBundle);
          console.log("[E2EE] Fresh keys generated and uploaded");
          set({ isSignalConfigured: true, isPassphraseModalOpen: true, passphraseMode: "setup" });
        } else {
          throw e;
        }
      }
    } catch (e) {
      console.error("[E2EE] Failed to setup E2EE keys:", e);
      toast.error("Failed to setup end-to-end encryption keys");
    }
  },

  // --- AUTH ACTIONS ---

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
      await get().checkLocalIdentity(res.data._id);
    } catch (error) {
      console.log("Error in authCheck:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", {
        fullName: data.fullName,
        email: data.email,
        password: data.password,
      });
      set({ authUser: res.data });
      toast.success("Account created successfully!");
      get().connectSocket();
      await get().checkLocalIdentity(res.data._id);
    } catch (error) {
      toast.error(error.response?.data?.message || "Signup failed");
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);

      // If logging in as a different user on this device, clear previous user's keys
      if (get().authUser && get().authUser._id !== res.data._id) {
        await clearAllCryptoState();
      }

      set({ authUser: res.data });
      toast.success("Logged in successfully");
      get().connectSocket();
      await get().checkLocalIdentity(res.data._id);
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({
        authUser: null,
        isSignalConfigured: false,
        isPassphraseModalOpen: false,
      });
      toast.success("Logged out successfully");
      get().disconnectSocket();

      // NOTE: We intentionally do NOT clear IndexedDB on logout.
      // Keys persist in the browser so the same user can log back in without re-entering passphrase.
      // IndexedDB is only cleared when switching accounts or when user explicitly chooses "Generate new keys".

      try {
        const { useChatStore } = await import("./useChatStore");
        useChatStore.getState().clearChat();
      } catch (err) {
        console.warn("Could not clear chat store", err);
      }
    } catch (error) {
      toast.error("Error logging out");
      console.log("Logout error:", error);
    }
  },

  updateProfile: async (data) => {
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("Error in update profile:", error);
      toast.error(error.response.data.message);
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;

    const socketUrl = getSocketUrl();
    const socket = io(socketUrl, {
      withCredentials: true,
      reconnection: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("user_connected", { userId: authUser._id });
    });

    socket.on("error", (error) => console.error("[Socket.IO] Error:", error));
    socket.on("connect_error", (error) => console.error("[Socket.IO] Connection error:", error));

    set({ socket });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });
  },

  disconnectSocket: () => {
    if (get().socket?.connected) get().socket.disconnect();
  },
}));
