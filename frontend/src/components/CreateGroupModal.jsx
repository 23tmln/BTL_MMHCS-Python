import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";

function CreateGroupModal({ onClose }) {
  const { allContacts, createGroup, getAllContacts } = useChatStore();
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);

  const toggleMember = (memberId) => {
    setMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim() || memberIds.length === 0) return;

    setIsSubmitting(true);
    try {
      await createGroup({ name: name.trim(), memberIds });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100">Create group</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-100">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100"
            placeholder="Group name"
          />

          <div className="max-h-72 overflow-y-auto space-y-2">
            {allContacts.map((contact) => (
              <label
                key={contact._id}
                className="flex items-center gap-3 bg-slate-800/60 rounded-lg p-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={memberIds.includes(contact._id)}
                  onChange={() => toggleMember(contact._id)}
                  className="checkbox checkbox-info checkbox-sm"
                />
                <img src={contact.profilePic || "/avatar.png"} className="size-9 rounded-full" />
                <span className="text-slate-200">{contact.fullName}</span>
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={!name.trim() || memberIds.length === 0 || isSubmitting}
            className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2 font-medium"
          >
            {isSubmitting ? "Creating..." : "Create group"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateGroupModal;
