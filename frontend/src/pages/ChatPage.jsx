import { useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import ProfileHeader from "../components/ProfileHeader";
import ActiveTabSwitch from "../components/ActiveTabSwitch";
import ChatsList from "../components/ChatsList";
import ContactList from "../components/ContactList";
import ChatContainer from "../components/ChatContainer";
import NoConversationPlaceholder from "../components/NoConversationPlaceholder";
import PassphraseModal from "../components/PassphraseModal";

/**
 * ChatPage.jsx
 * Trang chính của ứng dụng sau khi đăng nhập thành công.
 * Sử dụng Zustand Store để lấy trạng thái selectedUser (đối tác đang chat) và danh bạ.
 * Gồm 2 phần chính:
 * - Bên Trái: Profile người dùng + Màn chuyển tab (Chats/Contacts) + Danh sách liên hệ
 * - Bên Phải: Khung chat hiện tại (ChatContainer) hoặc Màn hình chờ (NoConversationPlaceholder)
 */
function ChatPage() {
  const { activeTab, selectedUser, getMyChatPartners } = useChatStore();
  const { isSignalConfigured } = useAuthStore();

  useEffect(() => {
    if (isSignalConfigured) {
      getMyChatPartners();
    }
  }, [isSignalConfigured, getMyChatPartners]);

  return (
    <>
      <div className="relative w-full max-w-6xl h-[800px]">
        <BorderAnimatedContainer>
          {/* BÊN TRÁI */}
          <div className="w-80 bg-slate-800/50 backdrop-blur-sm flex flex-col">
            <ProfileHeader />
            <ActiveTabSwitch />

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {activeTab === "chats" ? <ChatsList /> : <ContactList />}
            </div>
          </div>

          {/* BÊN PHẢI */}
          <div className="flex-1 flex flex-col bg-slate-900/50 backdrop-blur-sm">
            {selectedUser ? <ChatContainer /> : <NoConversationPlaceholder />}
          </div>
        </BorderAnimatedContainer>
      </div>
      {/* Passphrase modal — Modal bao phủ toàn màn hình khi cần thao tác với khóa bảo mật E2EE */}
      <PassphraseModal />
    </>
  );
}

export default ChatPage;
