import { SettingsIcon, UsersIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import GroupDetailsModal from "./GroupDetailsModal";

function ChatHeader() {
  const { selectedUser, selectedGroup, setSelectedUser, setSelectedGroup } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const isGroup = !!selectedGroup;
  const title = isGroup ? selectedGroup.name : selectedUser.fullName;
  const subtitle = isGroup ? `${selectedGroup.memberIds?.length || 0} members` : onlineUsers.includes(selectedUser._id) ? "Online" : "Offline";
  const isOnline = !isGroup && onlineUsers.includes(selectedUser._id);

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape") {
        if (isGroup) setSelectedGroup(null);
        else setSelectedUser(null);
      }
    };

    window.addEventListener("keydown", handleEscKey);

    return () => window.removeEventListener("keydown", handleEscKey);
  }, [isGroup, setSelectedGroup, setSelectedUser]);

  return (
    <div
      className="flex justify-between items-center bg-slate-800/50 border-b
   border-slate-700/50 max-h-[84px] px-6 flex-1"
    >
      <div className="flex items-center space-x-3">
        {isGroup ? (
          <div className="size-12 rounded-full bg-slate-700 flex items-center justify-center text-cyan-300">
            <UsersIcon className="w-6 h-6" />
          </div>
        ) : (
          <div className={`avatar ${isOnline ? "online" : "offline"}`}>
            <div className="w-12 rounded-full">
              <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
            </div>
          </div>
        )}

        <div>
          <h3 className="text-slate-200 font-medium">{title}</h3>
          <p className="text-slate-400 text-sm">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isGroup && (
          <button type="button" onClick={() => setIsDetailsOpen(true)}>
            <SettingsIcon className="w-5 h-5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer" />
          </button>
        )}
        <button onClick={() => (isGroup ? setSelectedGroup(null) : setSelectedUser(null))}>
          <XIcon className="w-5 h-5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer" />
        </button>
      </div>
      {isDetailsOpen && <GroupDetailsModal onClose={() => setIsDetailsOpen(false)} />}
    </div>
  );
}
export default ChatHeader;
