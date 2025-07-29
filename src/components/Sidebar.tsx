import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ActiveChat } from "./ChatApp";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";

interface SidebarProps {
  activeChat: ActiveChat | null;
  setActiveChat: (chat: ActiveChat | null) => void;
  onShowUserManagement: () => void;
  onShowProfileSetup: () => void;
  onShowGroupManagement: (groupId: Id<"groups">, groupName: string) => void;
}

export function Sidebar({ activeChat, setActiveChat, onShowUserManagement, onShowProfileSetup, onShowGroupManagement }: SidebarProps) {
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  
  const groups = useQuery(api.groups.getUserGroups) || [];
  const friends = useQuery(api.users.getFriends) || [];
  const currentUser = useQuery(api.users.getCurrentUser);
  const createGroup = useMutation(api.groups.createGroup);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    try {
      const groupId = await createGroup({
        name: groupName,
        description: groupDescription || undefined,
        isPrivate: false,
      });
      
      setActiveChat({
        type: "group",
        id: groupId,
        name: groupName,
      });
      
      setGroupName("");
      setGroupDescription("");
      setShowCreateGroup(false);
      toast.success("Group created successfully!");
    } catch (error) {
      toast.error("Failed to create group");
    }
  };

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Chats</h2>
          <div className="flex space-x-2">
            <button
              onClick={onShowProfileSetup}
              className="px-2 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
              title="Profile"
            >
              👤
            </button>
            <button
              onClick={onShowUserManagement}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Users
            </button>
          </div>
        </div>
        
        {currentUser && (
          <div className="flex items-center space-x-3 mb-4 p-2 bg-gray-50 dark:bg-gray-700 rounded">
            {currentUser.profilePhotoUrl ? (
              <img
                src={currentUser.profilePhotoUrl}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300">
                {(currentUser.nickname || currentUser.name || currentUser.email || "?")[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {currentUser.nickname || currentUser.name || "Set nickname"}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {currentUser.email}
              </div>
            </div>
          </div>
        )}
        
        <button
          onClick={() => setShowCreateGroup(!showCreateGroup)}
          className="w-full px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600"
        >
          {showCreateGroup ? "Cancel" : "Create Group"}
        </button>

        {showCreateGroup && (
          <form onSubmit={handleCreateGroup} className="mt-3 space-y-2">
            <input
              type="text"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              type="submit"
              className="w-full px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Create
            </button>
          </form>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Groups</h3>
          <div className="space-y-1">
            {groups.filter((group): group is NonNullable<typeof group> => group !== null).map((group) => (
              <div key={group._id} className="group relative">
                <button
                  onClick={() => setActiveChat({
                    type: "group",
                    id: group._id,
                    name: group.name,
                  })}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${
                    activeChat?.type === "group" && activeChat.id === group._id
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                  }`}
                >
                  <div className="font-medium">{group.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                    <span>{group.description && group.description.length > 20 ? group.description.substring(0, 20) + "..." : group.description}</span>
                    <span>{group.memberCount} members</span>
                  </div>
                </button>
                <button
                  onClick={() => onShowGroupManagement(group._id, group.name)}
                  className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  ⚙️
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Friends</h3>
          <div className="space-y-1">
            {friends.filter((friend): friend is NonNullable<typeof friend> => friend !== null).map((friend) => (
              <button
                key={friend._id}
                onClick={() => setActiveChat({
                  type: "direct",
                  id: friend._id,
                  name: friend.nickname || friend.name || friend.email || "Unknown",
                })}
                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center space-x-2 ${
                  activeChat?.type === "direct" && activeChat.id === friend._id
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                }`}
              >
                {friend.profilePhotoUrl ? (
                  <img
                    src={friend.profilePhotoUrl}
                    alt="Profile"
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                    {(friend.nickname || friend.name || friend.email || "?")[0].toUpperCase()}
                  </div>
                )}
                <div className="font-medium">{friend.nickname || friend.name || friend.email}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
