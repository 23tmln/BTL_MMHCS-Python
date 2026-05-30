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
  // Luôn kết nối cùng nguồn gốc — Vite proxy ở dev sẽ chuyển tiếp /socket.io đến backend
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

  // Trạng thái của modal nhập passphrase
  isPassphraseModalOpen: false,
  passphraseMode: "setup", // "setup" | "restore"

  // --- SAO LƯU / KHÔI PHỤC BẰNG PASSPHRASE (MẬT KHẨU CỤC BỘ) ---

  /**
   * Mã hóa toàn bộ dữ liệu private bundle (các khóa ngẫu nhiên) sinh ra tại thiết bị của user
   * bằng một passphrase do user tự đặt. Sau đó upload gói đã mã hóa này lên server để làm backup.
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
        // Lưu passphrase cục bộ để tự động sao lưu ẩn khi có tin nhắn mới
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
        // Chạy ngầm không hiện thông báo
        await get().backupKeysWithPassphrase(passphrase, true);
      }
    } catch (e) {
      console.warn("[E2EE] Could not trigger auto-backup", e);
    }
  },

  /**
   * Tải gói mã hóa từ server và giải mã bằng passphrase.
   * Khôi phục tất cả khóa tư + trạng thái session + cache tin nhắn vào IndexedDB.
   * Sau khi khôi phục, tự động tải lại phiên chat đang mở để các tin nhắn trong cache
   * hiển thị ngay lập tức mà không cần người dùng phải chuyển trang.
   */
  restoreKeysWithPassphrase: async (passphrase) => {
    const { authUser } = get();
    if (!authUser) return;
    try {
      const res = await axiosInstance.get("/keys/backup/me");
      const { encryptedBundle } = res.data;
      const bundle = await decryptPrivateBundle(encryptedBundle, passphrase);
      // importFullPrivateBundle bây giờ cũng khôi phục cả cache văn bản gốc của tin nhắn
      await importFullPrivateBundle(bundle);

      // Tải lên gói công khai để server có public key mới nhất
      const publicBundle = await getPublicBundleForUser(authUser._id);
      await axiosInstance.post("/keys/upload", publicBundle);

      set({ isSignalConfigured: true, isPassphraseModalOpen: false });
      toast.success("✅ Keys restored! Lịch sử tin nhắn đã được khôi phục.");
      console.log("[E2EE] Keys restored from passphrase backup");
      
      // Lưu passphrase cục bộ để tự động sao lưu ẩn khi có tin nhắn mới
      const { saveKey } = await import("../lib/secureStore");
      await saveKey("auto_backup_passphrase", passphrase);

      // Tải lại phiên chat đang mở để các tin nhắn trong cache xuất hiện ngay lập tức
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
   * Bỏ qua việc khôi phục — tạo ra các khóa hoàn toàn mới. Tin nhắn cũ sẽ không thể đọc được.
   * Hành động này sẽ XÓA SẠCH bao gồm cả cache tin nhắn (người dùng tự ý chấp nhận mất lịch sử).
   */
  skipRestoreAndGenerateNewKeys: async () => {
    const { authUser } = get();
    if (!authUser) return;
    // preserveMessageCache = false → xóa toàn bộ, người dùng có nhận thức chấp nhận mất lịch sử cũ
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

  // --- THIẾT LẬP DANH TÍNH (SIGNAL PROTOCOL) ---

  checkLocalIdentity: async (userId) => {
    // Hàm này chạy ngay sau khi quá trình Auth (đăng nhập/tải lại trang) thành công
    // Nó kiểm tra xem IndexedDB hiện tại của thiết bị đã có khóa Private/Public của user này chưa.
    try {
      const hasKeys = await hasKeysForUser(userId);

      if (hasKeys) {
        // Các khóa cục bộ đã tồn tại — chỉ cần đồng bộ cập nhật khóa công khai lên server rồi tiếp tục
        console.log("[E2EE] Local keys found. Syncing public bundle...");
        try {
          const publicBundle = await getPublicBundleForUser(userId);
          await axiosInstance.post("/keys/upload", publicBundle);
          console.log("[E2EE] Public bundle uploaded successfully");
          set({ isSignalConfigured: true });
          return;
        } catch (bundleErr) {
          // Xảy ra khi file khóa cục bộ vẫn còn nhưng BỊ KHUYẾT THIẾU (ví dụ thiếu chữ ký).
          // Coi nó giống như trường hợp "no local keys": kiểm tra backup server để dự phòng.
          console.warn("[E2EE] Local keys incomplete or corrupt:", bundleErr.message,
            "— falling through to backup check.");
          // Xóa khóa/thất bại phiên nhưng GIỮ LẠI cache văn bản tin nhắn để
          // người dùng vẫn xem lại được tin cũ nếu hoàn tất restore.
          const { clearAllCryptoState } = await import("../lib/secureStore.js");
          await clearAllCryptoState(true); // preserveMessageCache = true
        }
      }

      // Chưa có key local (hoặc vừa bị xóa) — kiểm tra trên server có bản lưu mật nào không
      console.log("[E2EE] No valid local keys. Checking server for encrypted backup...");
      try {
        await axiosInstance.get("/keys/backup/me");
        // Backup tồn tại → yêu cầu người dùng khôi phục bằng passphrase
        console.log("[E2EE] Backup found on server. Prompting restore...");
        set({ isPassphraseModalOpen: true, passphraseMode: "restore" });
      } catch (e) {
        if (e.response?.status === 404) {
          // Không tìm thấy bản lưu cấu hình nào — Sinh key mới tinh hoàn toàn
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

      // Nếu người đăng nhập là một tài khoản khác hoàn toàn trên cùng máy này, xóa IndexedDB của người trước
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

      // LƯU Ý: Về có ý đồ, chúng tôi KHÔNG xóa IndexedDB khi thao tác Logout.
      // Do đó Key vẫn được lưu trong Web để lần tới chính tài khoản tự login lại k bị bắt gõ passphrase.
      // Việc Xóa IndexedDB chỉ kích hoạt ngay khi login bằng một tải khoản khác hoặc khi họ chọn "Bỏ qua & tạo khóa mới"
      
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
