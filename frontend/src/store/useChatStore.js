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
    set({ isMessagesLoading: true });
    try {
      const { authUser } = useAuthStore.getState();
      const res = await axiosInstance.get(`/messages/${userId}`);
      
      const ciphertexts = res.data;
      const plaintexts = [];

      // Decrypt messages sequentially to maintain Signal Protocol chain state integrity
      for (const msg of ciphertexts) {
        try {
          if (msg.senderId === authUser._id) {
            // Sender cannot decrypt their own ciphertext (Signal is asymmetric).
            // Check message plaintext cache first — populated when message was sent.
            const cached = await getCachedMessage(msg._id);
            if (cached) {
              msg.text = cached;
            } else {
              msg.text = "[Bạn đã gửi tin nhắn mã hóa]";
            }
          } else if (!msg.ciphertext || !msg.messageType) {
            // Message has no encrypted data (e.g. image-only or legacy format)
            msg.text = msg.text || "";
          } else {
            // Check message cache first (Zalo/WhatsApp model):
            // If we've successfully decrypted this message before, use the cached plaintext.
            // This is the key mechanism that allows reading old messages after backup restore.
            const cached = await getCachedMessage(msg._id);
            if (cached !== undefined && cached !== null) {
              msg.text = cached;
            } else {
              // Not cached yet — try Signal decryption
              const dec = await decryptWithSignal(
                authUser._id,
                msg.senderId,
                msg.ciphertext,
                msg.messageType
              );
              msg.text = dec;
              // Save to cache so future loads and backup restores can access this plaintext
              await cacheMessage(msg._id, dec);
              useAuthStore.getState().autoBackupKeys();
            }
          }
        } catch (e) {
          // Classify the error for better UX messaging
          const errMsg = e?.message || "";
          if (
            errMsg.includes("MessageCounterError") ||
            errMsg.includes("key not found") ||
            errMsg.includes("No record for") ||
            errMsg.includes("No session") ||
            // "Bad MAC" = ratchet already advanced past this message (forward secrecy).
            // Happens when the same message is decrypted a second time after a
            // backup/restore cycle. The key was deleted after the first decryption.
            errMsg.includes("Bad MAC") ||
            errMsg.includes("bad mac") ||
            errMsg.includes("MAC")
          ) {
            // Old message from a previous session — expected after key regeneration or
            // after restoring from backup (session already past these messages)
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
      // 1. Fetch recipient's public key bundle
      const bundleRes = await axiosInstance.get(`/keys/${selectedUser._id}`);
      const recipientBundle = bundleRes.data;

      // 2. Encrypt message locally
      const { ciphertext, messageType, sessionId } = await encryptWithSignal(
        authUser._id,
        selectedUser._id,
        recipientBundle,
        messageData.text
      );

      // 3. Send ciphertext to backend
      const payload = {
        ciphertext,
        messageType,
        sessionId,
        image: messageData.image
      };

      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, payload);
      
      // 4. Cache the sent plaintext so we can display it on reload
      // (Signal is asymmetric — sender can't decrypt their own ciphertext)
      if (res.data._id && messageData.text) {
        await cacheMessage(res.data._id, messageData.text);
        useAuthStore.getState().autoBackupKeys();
      }

      // Update UI: replace optimistic message with the resolved one from server.
      // E2EE caveat: server returns the ciphertext. So we inject our plaintext over it.
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
    const { selectedUser, isSoundEnabled } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;
    if (!socket || !authUser) return;

    // Remove any existing listeners to prevent duplicates
    socket.off("newMessage");

    socket.on("newMessage", async (newMessage) => {
      const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;

      if (!isMessageSentFromSelectedUser) {
        return;
      }

      // Decrypt incoming message
      try {
        const plainText = await decryptWithSignal(
          authUser._id,
          newMessage.senderId,
          newMessage.ciphertext,
          newMessage.messageType
        );
        newMessage.text = plainText;

        // Cache the decrypted plaintext immediately for future backup restores
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
          // "Bad MAC" = session state mismatch (ratchet already advanced).
          // Resolves itself once both sides exchange a fresh PreKey message.
          errMsg.includes("Bad MAC") ||
          errMsg.includes("bad mac") ||
          errMsg.includes("MAC")
        ) {
          // Session mismatch — the sender is using an old session with us.
          // This resolves itself once BOTH sides exchange a fresh PreKey message.
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
