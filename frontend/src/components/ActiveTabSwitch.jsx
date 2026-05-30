import { useChatStore } from "../store/useChatStore";

function ActiveTabSwitch() {
  const { activeTab, setActiveTab } = useChatStore();

  const tabs = [
    { id: "chats", label: "Chats" },
    { id: "groups", label: "Groups" },
    { id: "contacts", label: "Contacts" },
  ];

  return (
    <div className="tabs tabs-boxed bg-transparent p-2 m-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`tab ${
            activeTab === tab.id ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
export default ActiveTabSwitch;
