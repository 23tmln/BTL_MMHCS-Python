import { PlusIcon, UsersIcon } from "lucide-react";
import { useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import CreateGroupModal from "./CreateGroupModal";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";

function GroupsList() {
  const { groups, getMyGroups, ensureMlsReady, isUsersLoading, isCreateGroupOpen, setCreateGroupOpen, setSelectedGroup } = useChatStore();
  const { authUser } = useAuthStore();

  useEffect(() => {
    if (!authUser) return;

    async function loadGroups() {
      await ensureMlsReady();
      await getMyGroups();
    }

    loadGroups();
  }, [authUser, ensureMlsReady, getMyGroups]);

  if (isUsersLoading && !isCreateGroupOpen) return <UsersLoadingSkeleton />;

  return (
    <>
      <button
        type="button"
        onClick={() => setCreateGroupOpen(true)}
        className="w-full bg-cyan-500/20 text-cyan-300 rounded-lg px-4 py-3 flex items-center justify-center gap-2 hover:bg-cyan-500/30 transition-colors"
      >
        <PlusIcon className="w-4 h-4" />
        Create group
      </button>

      {groups.length === 0 ? (
        <div className="text-center text-slate-400 py-8">No groups yet</div>
      ) : (
        groups.map((group) => (
          <div
            key={group._id}
            className="bg-cyan-500/10 p-4 rounded-lg cursor-pointer hover:bg-cyan-500/20 transition-colors"
            onClick={() => setSelectedGroup(group)}
          >
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-full bg-slate-700 flex items-center justify-center text-cyan-300">
                <UsersIcon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h4 className="text-slate-200 font-medium truncate">{group.name}</h4>
                <p className="text-slate-400 text-sm">{group.memberIds?.length || 0} members</p>
              </div>
            </div>
          </div>
        ))
      )}

      {isCreateGroupOpen && <CreateGroupModal onClose={() => setCreateGroupOpen(false)} />}
    </>
  );
}

export default GroupsList;
