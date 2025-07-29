import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

interface UserManagementProps {
  onClose: () => void;
}

export function UserManagement({ onClose }: UserManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "friends" | "requests">("search");

  const searchResults = useQuery(
    api.users.searchUsers,
    searchQuery.trim() ? { query: searchQuery.trim() } : "skip"
  ) || [];
  
  const friends = useQuery(api.users.getFriends) || [];
  const pendingRequests = useQuery(api.users.getPendingRequests) || [];

  const sendFriendRequest = useMutation(api.users.sendFriendRequest);
  const respondToFriendRequest = useMutation(api.users.respondToFriendRequest);
  const blockUser = useMutation(api.users.blockUser);

  const handleSendFriendRequest = async (userId: string) => {
    try {
      await sendFriendRequest({ targetUserId: userId as any });
      toast.success("Friend request sent!");
    } catch (error) {
      toast.error("Failed to send friend request");
    }
  };

  const handleRespondToRequest = async (relationshipId: string, accept: boolean) => {
    try {
      await respondToFriendRequest({ 
        relationshipId: relationshipId as any, 
        accept 
      });
      toast.success(accept ? "Friend request accepted!" : "Friend request rejected");
    } catch (error) {
      toast.error("Failed to respond to request");
    }
  };

  const handleBlockUser = async (userId: string) => {
    try {
      await blockUser({ targetUserId: userId as any });
      toast.success("User blocked");
    } catch (error) {
      toast.error("Failed to block user");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Список пользователей</h2>
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>

        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => setActiveTab("search")}
            className={`px-3 py-2 text-sm rounded ${
              activeTab === "search"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            Поиск Пользователей
          </button>
          <button
            onClick={() => setActiveTab("friends")}
            className={`px-3 py-2 text-sm rounded ${
              activeTab === "friends"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            Друзья ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`px-3 py-2 text-sm rounded ${
              activeTab === "requests"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            Заявки ({pendingRequests.length})
          </button>
        </div>

        {activeTab === "search" && (
          <input
            type="text"
            placeholder="Введите никнейм..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "search" && (
          <div className="space-y-3">
            {searchResults.filter((user): user is NonNullable<typeof user> => user !== null).map((user) => (
              <div key={user._id} className="flex justify-between items-center p-3 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
                <div className="flex items-center space-x-3">
                  {user.profilePhotoUrl ? (
                    <img
                      src={user.profilePhotoUrl}
                      alt="Profile"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300">
                      {(user.nickname || user.name || user.email || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{user.nickname || user.name || user.email}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                  </div>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => handleSendFriendRequest(user._id)}
                    className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Добавить в друзья
                  </button>
                  <button
                    onClick={() => handleBlockUser(user._id)}
                    className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Заблокировать
                  </button>
                </div>
              </div>
            ))}
            {searchQuery.trim() && searchResults.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                Ничего не найдено
              </div>
            )}
          </div>
        )}

        {activeTab === "friends" && (
          <div className="space-y-3">
            {friends.filter((friend): friend is NonNullable<typeof friend> => friend !== null).map((friend) => (
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
                  onClick={() => handleBlockUser(friend._id)}
                  className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Заблокировать
                </button>
              </div>
            ))}
            {friends.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                Пока нет друзей
              </div>
            )}
          </div>
        )}

        {activeTab === "requests" && (
          <div className="space-y-3">
            {pendingRequests.filter((request): request is NonNullable<typeof request> => request !== null).map((request) => (
              <div key={request._id} className="flex justify-between items-center p-3 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
                <div className="flex items-center space-x-3">
                  {request.user.profilePhotoUrl ? (
                    <img
                      src={request.user.profilePhotoUrl}
                      alt="Profile"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300">
                      {(request.user.nickname || request.user.name || request.user.email || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{request.user.nickname || request.user.name || request.user.email}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{request.user.email}</div>
                  </div>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => handleRespondToRequest(request._id, true)}
                    className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Принять
                  </button>
                  <button
                    onClick={() => handleRespondToRequest(request._id, false)}
                    className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            ))}
            {pendingRequests.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                Пока нет заявок
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
