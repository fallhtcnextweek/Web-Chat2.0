import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // User profiles for extended user data
  userProfiles: defineTable({
    userId: v.id("users"),
    nickname: v.optional(v.string()),
    profilePhotoId: v.optional(v.id("_storage")),
  })
    .index("by_user", ["userId"])
    .index("by_nickname", ["nickname"]),

  // Friends and blacklist relationships
  userRelationships: defineTable({
    userId: v.id("users"),
    targetUserId: v.id("users"),
    type: v.union(v.literal("friend"), v.literal("blocked")),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected")),
  })
    .index("by_user", ["userId"])
    .index("by_target", ["targetUserId"])
    .index("by_user_and_target", ["userId", "targetUserId"]),

  // Groups/channels
  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    isPrivate: v.boolean(),
  })
    .index("by_creator", ["createdBy"]),

  // Group memberships
  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
    joinedAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_and_user", ["groupId", "userId"]),

  // Messages
  messages: defineTable({
    content: v.optional(v.string()),
    authorId: v.id("users"),
    groupId: v.optional(v.id("groups")),
    recipientId: v.optional(v.id("users")), // For direct messages
    type: v.union(v.literal("text"), v.literal("file"), v.literal("reply")),
    fileId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileType: v.optional(v.string()),
    replyToId: v.optional(v.id("messages")),
    isDeleted: v.optional(v.boolean()),
    editedAt: v.optional(v.number()),
  })
    .index("by_group", ["groupId"])
    .index("by_recipient", ["recipientId"])
    .index("by_author", ["authorId"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["groupId", "authorId"],
    }),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
