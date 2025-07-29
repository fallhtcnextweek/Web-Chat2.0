import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";

interface GroupManagementProps {
  groupId: Id<"groups">;
  groupName: string;
  onClose: () => void;
}

export function GroupManagement({ groupId, groupName, onClose }: GroupManagementProps) {
  const [activeTab, setActiveTab] = useState<"members" | "add">("members");

  const members = useQuery(api.groups.getGroupMembers, { groupId }) || [];
  const availableFriends = useQuery(api.groups.getAvailableFriendsForGroup, { groupId }) || [];
  
  const addMember = useMutation(api.groups.addMemberToGroup);
  const removeMember = useMutation(api.groups.removeMemberFromGroup);
  const leaveGroup = useMutation(api.groups.leaveGroup);

  const currentUser = useQuery(api.users.getCurrentUser);
  const filteredMembers = members.filter((member): member is NonNullable<typeof member> => member !== null);
  const filteredFriends = availableFriends.filter((friend): friend is NonNullable<typeof friend> => friend !== null);
  const isAdmin = filteredMembers.find(m => m._id === currentUser?._id)?.role === "admin";

  const handleAddMember = async (userId: Id<"users">) => {
    try {
      await addMember({ groupId, userId });
      toast.success("Member added successfully!");
    } catch (error) {
      toast.error("Failed to add member");
    }
  };

  const handleRemoveMember = async (userId: Id<"users">) => {
    try {
      await removeMember({ groupId, userId });
      toast.success("Member removed successfully!");
    } catch (error) {
      toast.error("Failed to remove member");
    }
  };

  const handleLeaveGroup = async () => {
    try {
      await leaveGroup({ groupId });
      toast.success("Left group successfully!");
      onClose();
    } catch (error) {
      toast.error("Failed to leave group");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Manage "{groupName}"</h2>
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>

        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => setActiveTab("members")}
            className={`px-3 py-2 text-sm rounded ${
              activeTab === "members"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            Members ({filteredMembers.length})
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("add")}
              className={`px-3 py-2 text-sm rounded ${
                activeTab === "add"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              Add Friends ({filteredFriends.length})
            </button>
          )}
        </div>

        {!isAdmin && (
          <button
            onClick={handleLeaveGroup}
            className="w-full px-3 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600"
          >
            Leave Group
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "members" && (
          <div className="space-y-3">
            {filteredMembers.map((member) => (
              <div key={member._id} className="flex justify-between items-center p-3 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
                <div className="flex items-center space-x-3">
                  {member.profilePhotoUrl ? (
                    <img
                      src={member.profilePhotoUrl}
                      alt="Profile"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300">
                      {(member.nickname || member.name || member.email || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {member.nickname || member.name || member.email}
                      {member.role === "admin" && (
                        <span className="ml-2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{member.email}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                {isAdmin && member._id !== currentUser?._id && member.role !== "admin" && (
                  <button
                    onClick={() => handleRemoveMember(member._id)}
                    className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "add" && isAdmin && (
          <div className="space-y-3">
            {filteredFriends.map((friend) => (
              <div key={friend._id} className="flex justify-between items-center p-3 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
                <div className="flex items-center space-x-3">
                  {friend.profilePhotoUrl ? (
                    <img
                      src={friend.profilePhotoUrl}
                      alt="Profile"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300">
                      {(friend.nickname || friend.name || friend.email || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{friend.nickname || friend.name || friend.email}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{friend.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleAddMember(friend._id)}
                  className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Add to Group
                </button>
              </div>
            ))}
            {filteredFriends.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                No friends available to add
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
