import { LogOutIcon, UserPlusIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

function GroupDetailsModal({ onClose }) {
  const {
    addGroupMembers,
    allContacts,
    getAllContacts,
    leaveGroup,
    removeGroupMember,
    selectedGroup,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const [memberIdsToAdd, setMemberIdsToAdd] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);

  const isAdmin = selectedGroup?.adminId === authUser?._id;
  const availableContacts = useMemo(() => {
    const currentMemberIds = new Set(selectedGroup?.memberIds || []);
    return allContacts.filter((contact) => !currentMemberIds.has(contact._id));
  }, [allContacts, selectedGroup]);

  if (!selectedGroup) return null;

  const toggleMemberToAdd = (memberId) => {
    setMemberIdsToAdd((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    );
  };

  const handleAddMembers = async () => {
    if (memberIdsToAdd.length === 0) return;
    setIsSubmitting(true);
    try {
      await addGroupMembers(selectedGroup._id, memberIdsToAdd);
      setMemberIdsToAdd([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeave = async () => {
    setIsSubmitting(true);
    try {
      await leaveGroup(selectedGroup._id);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (memberId) => {
    setIsSubmitting(true);
    try {
      await removeGroupMember(selectedGroup._id, memberId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{selectedGroup.name}</h2>
            <p className="text-sm text-slate-400">{selectedGroup.memberIds?.length || 0} members</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-100">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <h3 className="text-slate-200 font-medium mb-2">Members</h3>
            <div className="space-y-2">
              {(selectedGroup.members || []).map((member) => (
                <div key={member._id} className="flex items-center justify-between bg-slate-800/60 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <img src={member.profilePic || "/avatar.png"} className="size-9 rounded-full" />
                    <div>
                      <p className="text-slate-200">{member.fullName}</p>
                      {selectedGroup.adminId === member._id && <p className="text-xs text-cyan-300">Admin</p>}
                    </div>
                  </div>
                  {isAdmin && member._id !== authUser._id && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleRemove(member._id)}
                      className="text-sm text-red-300 hover:text-red-200 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div>
              <h3 className="text-slate-200 font-medium mb-2">Add members</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableContacts.length === 0 ? (
                  <p className="text-slate-400 text-sm">No contacts available to add</p>
                ) : (
                  availableContacts.map((contact) => (
                    <label key={contact._id} className="flex items-center gap-3 bg-slate-800/60 rounded-lg p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={memberIdsToAdd.includes(contact._id)}
                        onChange={() => toggleMemberToAdd(contact._id)}
                        className="checkbox checkbox-info checkbox-sm"
                      />
                      <img src={contact.profilePic || "/avatar.png"} className="size-9 rounded-full" />
                      <span className="text-slate-200">{contact.fullName}</span>
                    </label>
                  ))
                )}
              </div>
              <button
                type="button"
                disabled={memberIdsToAdd.length === 0 || isSubmitting}
                onClick={handleAddMembers}
                className="mt-3 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 flex items-center gap-2"
              >
                <UserPlusIcon className="w-4 h-4" />
                Add selected
              </button>
            </div>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleLeave}
            className="w-full bg-red-500/20 text-red-200 hover:bg-red-500/30 disabled:opacity-50 rounded-lg py-2 flex items-center justify-center gap-2"
          >
            <LogOutIcon className="w-4 h-4" />
            Leave group
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupDetailsModal;
