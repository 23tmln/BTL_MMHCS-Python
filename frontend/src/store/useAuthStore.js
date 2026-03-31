import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

// Dynamically determine Socket.IO server URL based on current location
// In development: use same hostname as frontend but with backend port (3000)
// In production: use relative path (same origin)
const getSocketUrl = () => {
  if (import.meta.env.MODE === "development") {
    const protocol = window.location.protocol; // http: or https:
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:3000`;
  }
  return window.location.origin;
};

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  isSigningUp: false,
  isLoggingIn: false,
  socket: null,
  onlineUsers: [],

  isSecureStorageConfigured: null,
  isCheckingSecureStorage: false,
  isSecureStorageRestored: false,
  secureStorageError: null,
  isSecureStorageBusy: false,
  sessionPin: null, // PIN kept in memory for auto-backup after sending messages

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
      await get().checkSecureStorage();
    } catch (error) {
      console.log("Error in authCheck:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  checkSecureStorage: async () => {
    set({ isCheckingSecureStorage: true, secureStorageError: null });
    try {
      const res = await axiosInstance.get("/secure-storage/status");
      set({
        isSecureStorageConfigured: res.data?.configured || false,
        isSecureStorageRestored: false,
      });
    } catch (error) {
      const message = error?.response?.data?.message || "Failed to read secure storage status";
      set({ secureStorageError: message });
    } finally {
      set({ isCheckingSecureStorage: false });
    }
  },

  setupSecureStorage: async (pin) => {
    set({ isSecureStorageBusy: true, secureStorageError: null });
    try {
      const res = await axiosInstance.post("/secure-storage/setup", { pin });
      set({ isSecureStorageConfigured: true, isSecureStorageRestored: true, sessionPin: pin });
      toast.success(res.data?.message || "Secure storage configured");
      return true;
    } catch (error) {
      const message = error?.response?.data?.detail || error?.response?.data?.error || "Failed to setup secure storage";
      toast.error(message);
      set({ secureStorageError: message });
      return false;
    } finally {
      set({ isSecureStorageBusy: false });
    }
  },

  restoreSecureStorage: async (pin) => {
    set({ isSecureStorageBusy: true, secureStorageError: null });
    try {
      const res = await axiosInstance.post("/secure-storage/restore", { pin });
      set({ isSecureStorageRestored: true, sessionPin: pin });
      toast.success(res.data?.message || "Secure storage restored");
      return true;
    } catch (error) {
      const message = error?.response?.data?.detail || error?.response?.data?.error || "Failed to restore secure storage";
      toast.error(message);
      set({ secureStorageError: message });
      return false;
    } finally {
      set({ isSecureStorageBusy: false });
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

      // After signup, secure storage flow is handled in ChatPage modal after login check.
      await get().checkSecureStorage();
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
      set({ authUser: res.data });

      toast.success("Logged in successfully");

      get().connectSocket();
      await get().checkSecureStorage();
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
        // Reset all secure storage state so PIN modal shows on next login
        isSecureStorageConfigured: null,
        isSecureStorageRestored: false,
        secureStorageError: null,
        sessionPin: null,
      });
      toast.success("Logged out successfully");
      get().disconnectSocket();

      // Clear chat store state when logged out so we don't bleed previous chat context on the UI
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
    console.log("[Socket.IO] Connecting to:", socketUrl);

    const socket = io(socketUrl, {
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("[Socket.IO] Connected with ID:", socket.id);
      // Emit user connected event with user ID after connection established
      socket.emit("user_connected", { userId: authUser._id });
      console.log("[Socket.IO] Emitted user_connected for user:", authUser._id);
    });

    socket.on("disconnect", () => {
      console.log("[Socket.IO] Disconnected");
    });

    socket.on("error", (error) => {
      console.error("[Socket.IO] Error:", error);
    });

    socket.on("connect_error", (error) => {
      console.error("[Socket.IO] Connection error:", error);
    });

    set({ socket });

    // listen for online users event
    socket.on("getOnlineUsers", (userIds) => {
      console.log("[Socket.IO] Online users:", userIds);
      set({ onlineUsers: userIds });
    });
  },

  disconnectSocket: () => {
    if (get().socket?.connected) get().socket.disconnect();
  },
}));
