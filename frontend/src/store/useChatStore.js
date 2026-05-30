import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";
import { encryptWithSignal, decryptWithSignal } from "../lib/signalHelper";
import { getCachedMessage, cacheMessage } from "../lib/secureStore";

export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  messages: [],
  activeTab: "chats",
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,

  toggleSound: () => {
    localStorage.setItem("isSoundEnabled", !get().isSoundEnabled);
    set({ isSoundEnabled: !get().isSoundEnabled });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedUser: (selectedUser) => set({ selectedUser }),

  clearChat: () => set({ messages: [], chats: [], allContacts: [], selectedUser: null }),

  getAllContacts: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/contacts");
      set({ allContacts: res.data });
    } catch (error) {
      toast.error("Failed to load contacts");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMyChatPartners: async () => {
    set({ isUsersLoading: true });
    try {
      const contactsRes = await axiosInstance.get("/messages/contacts");
      const allContacts = contactsRes.data;

      const partnerIdsRes = await axiosInstance.get("/messages/chat-partner-ids");
      const chatPartnerIds = partnerIdsRes.data;

      const chatPartners = allContacts
        .filter((contact) => chatPartnerIds.includes(contact._id))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      set({ chats: chatPartners });
    } catch (error) {
      toast.error("Failed to load chats");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessagesByUserId: async (userId) => {
    // Tải về lịch sử trò chuyện (các tin nhắn đã bị mã hóa trên server)
    // Sau đó tiến hành dịch ra plaintext bằng cách giải mã cục bộ bằng các Session Key lưu trong trình duyệt.
    set({ isMessagesLoading: true });
    try {
      const { authUser } = useAuthStore.getState();
      const res = await axiosInstance.get(`/messages/${userId}`);
      
      const ciphertexts = res.data;
      const plaintexts = [];

      // Giải mã các tin nhắn một cách tuần tự để giữ tính toàn vẹn của chuỗi trạng thái Signal Protocol
      for (const msg of ciphertexts) {
        try {
          if (msg.senderId === authUser._id) {
            // Người gửi không thể giải mã ciphertext của chính họ (Signal là mã hóa bất đối xứng).
            // Kiểm tra cache văn bản tin nhắn trước — được điền khi tin nhắn được gửi đi.
            const cached = await getCachedMessage(msg._id);
            if (cached) {
              msg.text = cached;
            } else {
              msg.text = "[Bạn đã gửi tin nhắn mã hóa]";
            }
          } else if (!msg.ciphertext || !msg.messageType) {
            // Tin nhắn không có dữ liệu mã hóa (vd: chỉ có ảnh hoặc định dạng cũ)
            msg.text = msg.text || "";
          } else {
            // Kiểm tra bộ nhớ đệm tin nhắn trước (mô hình Zalo/WhatsApp):
            // Nếu đã giải mã thành công tin nhắn này trước đó, sử dụng văn bản gốc được cache.
            // Đây là cơ chế chính cho phép đọc tin nhắn cũ sau khi khôi phục bản sao lưu.
            const cached = await getCachedMessage(msg._id);
            if (cached !== undefined && cached !== null) {
              msg.text = cached;
            } else {
              // Chưa được cache — thử giải mã bằng Signal
              const dec = await decryptWithSignal(
                authUser._id,
                msg.senderId,
                msg.ciphertext,
                msg.messageType
              );
              msg.text = dec;
              // Lưu vào cache để các lần tải hoặc khôi phục sao lưu sau này có thể truy cập được văn bản gốc này
              await cacheMessage(msg._id, dec);
              useAuthStore.getState().autoBackupKeys();
            }
          }
        } catch (e) {
          // Phân loại lỗi để hiển thị thông báo UX tốt hơn
          const errMsg = e?.message || "";
          if (
            errMsg.includes("MessageCounterError") ||
            errMsg.includes("key not found") ||
            errMsg.includes("No record for") ||
            errMsg.includes("No session") ||
            // "Bad MAC" = ratchet đã tiếp tục thay đổi khóa vượt qua tin nhắn này (tính bảo mật chuyển tiếp).
            // Xảy ra khi cùng một tin nhắn được giải mã lần thứ hai sau khi
            // khôi phục bản sao lưu. Khóa giải mã đã bị xóa sau lần giải mã đầu tiên.
            errMsg.includes("Bad MAC") ||
            errMsg.includes("bad mac") ||
            errMsg.includes("MAC")
          ) {
            // Tin nhắn cũ từ một phiên kết nối trước đó — dự kiến có cảnh báo giả sau khi tạo lại khóa hoặc
            // sau khi phục hồi từ sao lưu (phiên lưu trữ đã đi qua các tin nhắn này)
            msg.text = "🔒 [Tin nhắn từ phiên cũ - không thể giải mã]";
          } else {
            console.warn("[Chat] Decrypt error for msg", msg._id, errMsg);
            msg.text = "⚠️ [Giải mã thất bại]";
          }
        }
        plaintexts.push(msg);
      }

      set({ messages: plaintexts });
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong loading messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    // Hàm mã hóa tin nhắn gốc (plaintext) trước khi gửi qua API.
    // Việc mã hóa này xảy ra ở phía Local (Client) bằng khóa chia sẻ (Shared Key) của giao thức.
    const { selectedUser, messages } = get();
    const { authUser } = useAuthStore.getState();

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text,
      image: messageData.image,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    set({ messages: [...messages, optimisticMessage] });

    try {
      // 1. Tải gói khóa công khai (public bundle) của người nhận
      const bundleRes = await axiosInstance.get(`/keys/${selectedUser._id}`);
      const recipientBundle = bundleRes.data;

      // 2. Mã hóa tin nhắn cục bộ
      const { ciphertext, messageType, sessionId } = await encryptWithSignal(
        authUser._id,
        selectedUser._id,
        recipientBundle,
        messageData.text
      );

      // 3. Gửi ciphertext lên backend
      const payload = {
        ciphertext,
        messageType,
        sessionId,
        image: messageData.image
      };

      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, payload);
      
      // 4. Cache văn bản đã gửi đi để ta có thể hiển thị lại khi reload 
      // (Signal bất đối xứng — người gửi không thể TỰ giải mã ciphertext của chính họ)
      if (res.data._id && messageData.text) {
        await cacheMessage(res.data._id, messageData.text);
        useAuthStore.getState().autoBackupKeys();
      }

      // Cập nhật UI: thay thế tin nhắn giả định ban đầu bằng kết quả thực từ server.
      // Đặc thù E2EE: server chỉ trả về ciphertext. Vậy nên ta phải tự chèn plaintext đè lên đó.
      const resolvedMessage = { ...res.data, text: messageData.text };

      const currentMessages = get().messages;
      const withoutOptimistic = currentMessages.filter((m) => m._id !== tempId);
      set({ messages: [...withoutOptimistic, resolvedMessage] });
      
    } catch (error) {
      console.error("[Chat] Error sending encrypted message:", error);
      const currentMessages = get().messages;
      set({ messages: currentMessages.filter((m) => m._id !== tempId) });
      toast.error("Failed to send encrypted message");
    }
  },

  subscribeToMessages: () => {
    // Đăng ký Event Lắng nghe tin nhắn phân phối từ Socket
    // Khi đối phương gửi tin, qua Server chuyển tiếp xuống thì tiến hành giải mã (NẾU hợp lệ).
    const { selectedUser, isSoundEnabled } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;
    if (!socket || !authUser) return;

    // Bỏ gắn bất kỳ hàm lắng nghe (listener) socket nào hiện có để ngăn tin nhắn bị lặp lại nhiều lần
    socket.off("newMessage");

    socket.on("newMessage", async (newMessage) => {
      const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;

      if (!isMessageSentFromSelectedUser) {
        return;
      }

      // Giải mã tin nhắn vừa nhận được
      try {
        const plainText = await decryptWithSignal(
          authUser._id,
          newMessage.senderId,
          newMessage.ciphertext,
          newMessage.messageType
        );
        newMessage.text = plainText;

        // Cache (lưu trữ) văn bản plaintext vừa giải mã ngay lập tức nhằm hỗ trợ khôi phục sau này
        if (newMessage._id) {
          await cacheMessage(newMessage._id, plainText);
          useAuthStore.getState().autoBackupKeys();
        }
      } catch (e) {
        const errMsg = e?.message || "";
        console.error("[Chat] Failed to decrypt real-time message:", errMsg);
        if (
          errMsg.includes("MessageCounterError") ||
          errMsg.includes("key not found") ||
          errMsg.includes("No record for") ||
          errMsg.includes("No session") ||
          // "Bad MAC" = Không khớp state của Session (mã chuyển tiếp ratchet đã khóa bị thay đổi).
          // Tự động khôi phục bình thường ngay khi 2 bên gửi qua lại một PreKey message mới.
          errMsg.includes("Bad MAC") ||
          errMsg.includes("bad mac") ||
          errMsg.includes("MAC")
        ) {
          // Kênh phiên bị lệch — người gửi dùng thông số quá cũ.
          // Lỗi hiển thị này TỰ MẤT BỎ NGAY LẬP TỨC khi nào hai người chat tương tác gửi lại tin thuộc loại PreKey message.
          newMessage.text = "🔒 [Tin nhắn từ phiên cũ - không thể giải mã]";
        } else {
          newMessage.text = "⚠️ [Giải mã thất bại]";
        }
      }

      const currentMessages = get().messages;
      set({ messages: [...currentMessages, newMessage] });

      if (isSoundEnabled) {
        const notificationSound = new Audio("/sounds/notification.mp3");
        notificationSound.currentTime = 0;
        notificationSound.play().catch((e) => console.log("Audio play failed:", e));
      }
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newMessage");
    }
  },
}));
