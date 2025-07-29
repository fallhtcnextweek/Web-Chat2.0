import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Sidebar } from "./Sidebar";
import { ChatWindow } from "./ChatWindow";
import { UserManagement } from "./UserManagement";
import { GroupManagement } from "./GroupManagement";
import { ProfileSetup } from "./ProfileSetup";
import { Id } from "../../convex/_generated/dataModel";

export type ChatType = "group" | "direct";

export interface ActiveChat {
  type: ChatType;
  id: Id<"groups"> | Id<"users">;
  name: string;
}

export function ChatApp() {
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showGroupManagement, setShowGroupManagement] = useState<{
    groupId: Id<"groups">;
    groupName: string;
  } | null>(null);
  
  const currentUser = useQuery(api.users.getCurrentUser);

  if (!currentUser) {
    return <div className="flex justify-center items-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-blue-400"></div>
    </div>;
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <Sidebar 
        activeChat={activeChat}
        setActiveChat={setActiveChat}
        onShowUserManagement={() => setShowUserManagement(true)}
        onShowProfileSetup={() => setShowProfileSetup(true)}
        onShowGroupManagement={(groupId, groupName) => 
          setShowGroupManagement({ groupId, groupName })
        }
      />
      
      <div className="flex-1 flex flex-col">
        {showUserManagement ? (
          <UserManagement onClose={() => setShowUserManagement(false)} />
        ) : showProfileSetup ? (
          <ProfileSetup onClose={() => setShowProfileSetup(false)} />
        ) : showGroupManagement ? (
          <GroupManagement 
            groupId={showGroupManagement.groupId}
            groupName={showGroupManagement.groupName}
            onClose={() => setShowGroupManagement(null)} 
          />
        ) : activeChat ? (
          <ChatWindow 
            activeChat={activeChat}
            currentUser={currentUser}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Добро Пожаловать!</h2>
              <p>выберите переписку чтобы начать</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
