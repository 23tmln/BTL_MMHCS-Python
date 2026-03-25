import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

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

  getAllContacts: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/contacts");
      set({ allContacts: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },
  getMyChatPartners: async () => {
    set({ isUsersLoading: true });
    try {
      // Get all contacts first
      const contactsRes = await axiosInstance.get("/messages/contacts");
      const allContacts = contactsRes.data;

      // Get chat partner IDs (users we've messaged with)
      const partnerIdsRes = await axiosInstance.get(
        "/messages/chat-partner-ids",
      );
      const chatPartnerIds = partnerIdsRes.data;

      // Filter contacts to only show users we've chatted with, sorted by name
      const chatPartners = allContacts
        .filter((contact) => chatPartnerIds.includes(contact._id))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      console.log(
        "[Chat] getMyChatPartners - found",
        chatPartners.length,
        "chat partners",
      );
      set({ chats: chatPartners });
    } catch (error) {
      console.error("[Chat] getMyChatPartners error:", error);
      toast.error(error.response?.data?.message || "Failed to load chats");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessagesByUserId: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
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

    // Update UI immediately with optimistic message
    set({ messages: [...messages, optimisticMessage] });
    console.log("[Chat] Sending message to:", selectedUser._id);

    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData,
      );
      console.log("[Chat] Message sent successfully, response:", res.data);

      // Remove optimistic message and add real one from server
      const currentMessages = get().messages;
      const withoutOptimistic = currentMessages.filter((m) => m._id !== tempId);
      set({ messages: [...withoutOptimistic, res.data] });
    } catch (error) {
      console.error("[Chat] Error sending message:", error);
      // remove optimistic message on failure
      const currentMessages = get().messages;
      set({ messages: currentMessages.filter((m) => m._id !== tempId) });
      toast.error(error.response?.data?.message || "Something went wrong");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser, isSoundEnabled } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) {
      console.warn("[Chat] Socket not available yet");
      return;
    }

    console.log("[Chat] Subscribing to messages from user:", selectedUser._id);
    console.log("[Chat] Socket connected?", socket.connected);

    socket.on("newMessage", (newMessage) => {
      console.log("[Chat] Received newMessage:", newMessage);
      const isMessageSentFromSelectedUser =
        newMessage.senderId === selectedUser._id;
      console.log(
        "[Chat] Message from selected user?",
        isMessageSentFromSelectedUser,
      );

      if (!isMessageSentFromSelectedUser) {
        console.log("[Chat] Ignoring message from different user");
        return;
      }

      const currentMessages = get().messages;
      console.log("[Chat] Adding message to messages array");
      set({ messages: [...currentMessages, newMessage] });

      if (isSoundEnabled) {
        const notificationSound = new Audio("/sounds/notification.mp3");
        notificationSound.currentTime = 0;
        notificationSound
          .play()
          .catch((e) => console.log("Audio play failed:", e));
      }
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newMessage");
      console.log("[Chat] Unsubscribed from messages");
    }
  },
}));
