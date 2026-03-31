import { useState, useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import ProfileHeader from "../components/ProfileHeader";
import ActiveTabSwitch from "../components/ActiveTabSwitch";
import ChatsList from "../components/ChatsList";
import ContactList from "../components/ContactList";
import ChatContainer from "../components/ChatContainer";
import NoConversationPlaceholder from "../components/NoConversationPlaceholder";

function ChatPage() {
  const { activeTab, selectedUser, getMyChatPartners } = useChatStore();
  const {
    authUser,
    isCheckingSecureStorage,
    isSecureStorageConfigured,
    isSecureStorageRestored,
    secureStorageError,
    isSecureStorageBusy,
    checkSecureStorage,
    setupSecureStorage,
    restoreSecureStorage,
    logout,
  } = useAuthStore();

  const [pin, setPin] = useState("");

  useEffect(() => {
    if (authUser && !isCheckingSecureStorage && isSecureStorageConfigured === null) {
      checkSecureStorage();
    }
  }, [authUser, isCheckingSecureStorage, isSecureStorageConfigured, checkSecureStorage]);

  useEffect(() => {
    if (isSecureStorageRestored) {
      getMyChatPartners();
    }
  }, [isSecureStorageRestored, getMyChatPartners]);

  const handleSecureStorageSubmit = async () => {
    if (!pin || pin.length < 4) return;

    if (isSecureStorageConfigured) {
      const success = await restoreSecureStorage(pin);
      if (success) getMyChatPartners();
    } else {
      const success = await setupSecureStorage(pin);
      if (success) getMyChatPartners();
    }
  };

  const renderSecureStorageModal = () => {
    if (isCheckingSecureStorage || isSecureStorageRestored) return null;

    const title = isSecureStorageConfigured
      ? "Restore secure storage"
      : "Setup secure storage";

    const description = isSecureStorageConfigured
      ? "Enter your PIN to restore your encrypted crypto state."
      : "Create a secure PIN to encrypt and backup your crypto state.";

    const actionText = isSecureStorageConfigured ? "Restore" : "Setup";

    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
        <div className="w-full max-w-md p-6 bg-slate-800 rounded-xl border border-slate-600">
          <h2 className="text-xl font-semibold text-white mb-3">{title}</h2>
          <p className="text-slate-300 mb-4">{description}</p>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN (min 4 chars)"
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white mb-3"
          />
          {secureStorageError && <p className="text-red-400 mb-2">{secureStorageError}</p>}
          <button
            onClick={handleSecureStorageSubmit}
            disabled={isSecureStorageBusy || pin.length < 4}
            className="w-full py-2 rounded-lg bg-cyan-500 text-slate-900 font-bold hover:bg-cyan-400 disabled:bg-slate-500"
          >
            {isSecureStorageBusy ? "Processing..." : actionText}
          </button>

          <button
            onClick={() => logout()}
            disabled={isSecureStorageBusy}
            className="w-full mt-3 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-500"
          >
            Logout
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full max-w-6xl h-[800px]">
      {renderSecureStorageModal()}
      <BorderAnimatedContainer>
        {/* LEFT SIDE */}
        <div className="w-80 bg-slate-800/50 backdrop-blur-sm flex flex-col">
          <ProfileHeader />
          <ActiveTabSwitch />

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {activeTab === "chats" ? <ChatsList /> : <ContactList />}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex-1 flex flex-col bg-slate-900/50 backdrop-blur-sm">
          {selectedUser ? <ChatContainer /> : <NoConversationPlaceholder />}
        </div>
      </BorderAnimatedContainer>
    </div>
  );
}

export default ChatPage;
