import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ActiveChat } from "./ChatApp";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { linkifyText } from "../utils/linkify";

interface ChatWindowProps {
  activeChat: ActiveChat;
  currentUser: any;
}

interface ReplyingTo {
  messageId: Id<"messages">;
  content: string;
  author: string;
}

interface EditingMessage {
  messageId: Id<"messages">;
  content: string;
}

export function ChatWindow({ activeChat, currentUser }: ChatWindowProps) {
  const [message, setMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const [editingMessage, setEditingMessage] = useState<EditingMessage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useQuery(
    activeChat.type === "group" ? api.messages.getGroupMessages : api.messages.getDirectMessages,
    activeChat.type === "group" 
      ? { groupId: activeChat.id as Id<"groups"> }
      : { otherUserId: activeChat.id as Id<"users"> }
  ) || [];

  const sendMessage = useMutation(api.messages.sendMessage);
  const editMessage = useMutation(api.messages.editMessage);
  const sendFileMessage = useMutation(api.messages.sendFileMessage);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    try {
      if (editingMessage) {
        await editMessage({
          messageId: editingMessage.messageId,
          content: message,
        });
        setEditingMessage(null);
        toast.success("Сообщение отправлено!");
      } else {
        const args = {
          content: message,
          ...(activeChat.type === "group" 
            ? { groupId: activeChat.id as Id<"groups"> }
            : { recipientId: activeChat.id as Id<"users"> }
          ),
          ...(replyingTo ? { replyToId: replyingTo.messageId } : {}),
        };

        await sendMessage(args);
        setReplyingTo(null);
      }
      setMessage("");
    } catch (error) {
      toast.error(editingMessage ? "Не удалось изменить" : "Не удалось отправить");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("только файлы формата JPEG, PNG, JPG, и GIF");
      return;
    }

    try {
      const uploadUrl = await generateUploadUrl();
      
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error("не удалось отправить");
      }

      const { storageId } = await result.json();

      const args = {
        fileId: storageId,
        fileName: file.name,
        fileType: file.type,
        ...(activeChat.type === "group" 
          ? { groupId: activeChat.id as Id<"groups"> }
          : { recipientId: activeChat.id as Id<"users"> }
        ),
      };

      await sendFileMessage(args);
      toast.success("Файл отправлен");
    } catch (error) {
      toast.error("Ошибка отправки файла");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteMessage = async (messageId: Id<"messages">) => {
    try {
      await deleteMessage({ messageId });
      toast.success("Сообщение удалено");
    } catch (error) {
      toast.error("Не удалось удалить сообщение");
    }
  };

  const handleReply = (messageId: Id<"messages">, content: string, author: string) => {
    setReplyingTo({ messageId, content, author });
    setEditingMessage(null);
  };

  const handleEdit = (messageId: Id<"messages">, content: string) => {
    setEditingMessage({ messageId, content });
    setMessage(content);
    setReplyingTo(null);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setMessage("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{activeChat.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
        {messages.map((msg) => (
          <div key={msg._id} className="group">
            {msg.replyTo && (
              <div className="ml-4 mb-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm border-l-2 border-gray-300 dark:border-gray-600">
                <div className="text-xs text-gray-600 dark:text-gray-400">Ответ {msg.replyTo.author}</div>
                <div className="text-gray-700 dark:text-gray-300">{msg.replyTo.content}</div>
              </div>
            )}
            
            <div className={`flex ${msg.author._id === currentUser._id ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                msg.author._id === currentUser._id
                  ? "bg-blue-500 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
              }`}>
                {msg.author._id !== currentUser._id && (
                  <div className="text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">{msg.author.name}</div>
                )}
                
                {msg.isDeleted ? (
                  <div className="italic text-gray-500 dark:text-gray-400">Сообщение удалено</div>
                ) : msg.type === "file" && msg.fileUrl ? (
                  <div>
                    <img 
                      src={msg.fileUrl} 
                      alt={msg.fileName}
                      className="max-w-full h-auto rounded"
                    />
                    <div className="text-xs mt-1 opacity-70">{msg.fileName}</div>
                  </div>
                ) : (
                  <div>{linkifyText(msg.content || "")}</div>
                )}
                
                <div className="text-xs mt-1 opacity-70 flex justify-between items-center">
                  <span>{new Date(msg._creationTime).toLocaleTimeString()}</span>
                  {msg.editedAt && <span className="italic">изменено</span>}
                </div>
              </div>
              
              {msg.author._id === currentUser._id && !msg.isDeleted && (
                <div className="ml-2 opacity-0 group-hover:opacity-100 flex flex-col space-y-1">
                  <button
                    onClick={() => handleReply(msg._id, msg.content || "File", msg.author.name)}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Ответить
                  </button>
                  {msg.type === "text" && (
                    <button
                      onClick={() => handleEdit(msg._id, msg.content || "")}
                      className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      Изменить
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteMessage(msg._id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Удалить
                  </button>
                </div>
              )}
              
              {msg.author._id !== currentUser._id && !msg.isDeleted && (
                <div className="ml-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => handleReply(msg._id, msg.content || "File", msg.author.name)}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Ответить
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {replyingTo && (
          <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm border-l-2 border-blue-500">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Ответ {replyingTo.author}</div>
                <div className="text-gray-700 dark:text-gray-300">{replyingTo.content}</div>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {editingMessage && (
          <div className="mb-2 p-2 bg-yellow-100 dark:bg-yellow-900 rounded text-sm border-l-2 border-yellow-500">
            <div className="flex justify-between items-start">
              <div className="text-yellow-800 dark:text-yellow-200">Изменить сообщение</div>
              <button
                onClick={cancelEdit}
                className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
              >
                ×
              </button>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={editingMessage ? "Изменить сообщение..." : "Написать сообщение..."}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          
          {!editingMessage && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/jpeg,image/png,image/jpg,image/gif"
                className="hidden"
              />
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                📎
              </button>
            </>
          )}
          
          <button
            type="submit"
            disabled={!message.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editingMessage ? "Изменить" : "Отправить"}
          </button>
        </form>
      </div>
    </div>
  );
}
