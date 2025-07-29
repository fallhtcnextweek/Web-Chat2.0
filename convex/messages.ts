import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const sendMessage = mutation({
  args: {
    content: v.string(),
    groupId: v.optional(v.id("groups")),
    recipientId: v.optional(v.id("users")),
    replyToId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Validate that either groupId or recipientId is provided
    if (!args.groupId && !args.recipientId) {
      throw new Error("Must specify either group or recipient");
    }

    // If sending to group, check membership
    if (args.groupId) {
      const membership = await ctx.db
        .query("groupMembers")
        .withIndex("by_group_and_user", (q) => 
          q.eq("groupId", args.groupId!).eq("userId", userId)
        )
        .first();

      if (!membership) {
        throw new Error("Not a member of this group");
      }
    }

    // If direct message, check if recipient has blocked sender
    if (args.recipientId) {
      const blocked = await ctx.db
        .query("userRelationships")
        .withIndex("by_user_and_target", (q) => 
          q.eq("userId", args.recipientId!).eq("targetUserId", userId)
        )
        .filter((q) => q.eq(q.field("type"), "blocked"))
        .first();

      if (blocked) {
        throw new Error("Cannot send message to this user");
      }
    }

    const messageId = await ctx.db.insert("messages", {
      content: args.content,
      authorId: userId,
      groupId: args.groupId,
      recipientId: args.recipientId,
      type: args.replyToId ? "reply" : "text",
      replyToId: args.replyToId,
    });

    return messageId;
  },
});

export const editMessage = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    if (message.authorId !== userId) {
      throw new Error("Can only edit your own messages");
    }

    if (message.type !== "text" && message.type !== "reply") {
      throw new Error("Can only edit text messages");
    }

    await ctx.db.patch(args.messageId, {
      content: args.content,
      editedAt: Date.now(),
    });
  },
});

export const sendFileMessage = mutation({
  args: {
    fileId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    groupId: v.optional(v.id("groups")),
    recipientId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif"];
    if (!allowedTypes.includes(args.fileType)) {
      throw new Error("File type not allowed");
    }

    // Same validation as text messages
    if (!args.groupId && !args.recipientId) {
      throw new Error("Must specify either group or recipient");
    }

    if (args.groupId) {
      const membership = await ctx.db
        .query("groupMembers")
        .withIndex("by_group_and_user", (q) => 
          q.eq("groupId", args.groupId!).eq("userId", userId)
        )
        .first();

      if (!membership) {
        throw new Error("Not a member of this group");
      }
    }

    if (args.recipientId) {
      const blocked = await ctx.db
        .query("userRelationships")
        .withIndex("by_user_and_target", (q) => 
          q.eq("userId", args.recipientId!).eq("targetUserId", userId)
        )
        .filter((q) => q.eq(q.field("type"), "blocked"))
        .first();

      if (blocked) {
        throw new Error("Cannot send message to this user");
      }
    }

    const messageId = await ctx.db.insert("messages", {
      authorId: userId,
      groupId: args.groupId,
      recipientId: args.recipientId,
      type: "file",
      fileId: args.fileId,
      fileName: args.fileName,
      fileType: args.fileType,
    });

    return messageId;
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Сообщение не найдено");

    if (message.authorId !== userId) {
      throw new Error("Можно удалить только свои сообщения");
    }

    await ctx.db.patch(args.messageId, { 
      isDeleted: true,
      content: undefined,
      fileId: undefined,
    });
  },
});

export const getGroupMessages = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check membership
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) => 
        q.eq("groupId", args.groupId).eq("userId", userId)
      )
      .first();

    if (!membership) {
      throw new Error("Не часть группы");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .order("desc")
      .take(50);

    const messagesWithDetails = await Promise.all(
      messages.map(async (message) => {
        const author = await ctx.db.get(message.authorId);
        const authorProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", message.authorId))
          .first();

        let fileUrl = null;
        let replyTo = null;

        if (message.fileId) {
          fileUrl = await ctx.storage.getUrl(message.fileId);
        }

        if (message.replyToId) {
          const replyMessage = await ctx.db.get(message.replyToId);
          if (replyMessage) {
            const replyAuthor = await ctx.db.get(replyMessage.authorId);
            const replyProfile = await ctx.db
              .query("userProfiles")
              .withIndex("by_user", (q) => q.eq("userId", replyMessage.authorId))
              .first();
            replyTo = {
              content: replyMessage.content,
              author: replyProfile?.nickname || replyAuthor?.name,
            };
          }
        }

        return {
          ...message,
          author: {
            _id: author?._id,
            name: authorProfile?.nickname || author?.name || "ноунейм",
          },
          fileUrl,
          replyTo,
        };
      })
    );

    return messagesWithDetails.reverse();
  },
});

export const getDirectMessages = query({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const messages = await ctx.db
      .query("messages")
      .filter((q) => 
        q.or(
          q.and(
            q.eq(q.field("authorId"), userId),
            q.eq(q.field("recipientId"), args.otherUserId)
          ),
          q.and(
            q.eq(q.field("authorId"), args.otherUserId),
            q.eq(q.field("recipientId"), userId)
          )
        )
      )
      .order("desc")
      .take(50);

    const messagesWithDetails = await Promise.all(
      messages.map(async (message) => {
        const author = await ctx.db.get(message.authorId);
        const authorProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", message.authorId))
          .first();

        let fileUrl = null;
        let replyTo = null;

        if (message.fileId) {
          fileUrl = await ctx.storage.getUrl(message.fileId);
        }

        if (message.replyToId) {
          const replyMessage = await ctx.db.get(message.replyToId);
          if (replyMessage) {
            const replyAuthor = await ctx.db.get(replyMessage.authorId);
            const replyProfile = await ctx.db
              .query("userProfiles")
              .withIndex("by_user", (q) => q.eq("userId", replyMessage.authorId))
              .first();
            replyTo = {
              content: replyMessage.content,
              author: replyProfile?.nickname || replyAuthor?.name || "ноунейм",
            };
          }
        }

        return {
          ...message,
          author: {
            _id: author?._id,
            name: authorProfile?.nickname || author?.name || "ноунейм",
          },
          fileUrl,
          replyTo,
        };
      })
    );

    return messagesWithDetails.reverse();
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    return await ctx.storage.generateUploadUrl();
  },
});
