import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const createGroup = mutation({
  args: { 
    name: v.string(),
    description: v.optional(v.string()),
    isPrivate: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const groupId = await ctx.db.insert("groups", {
      name: args.name,
      description: args.description,
      createdBy: userId,
      isPrivate: args.isPrivate,
    });

    // Add creator as admin
    await ctx.db.insert("groupMembers", {
      groupId,
      userId,
      role: "admin",
      joinedAt: Date.now(),
    });

    return groupId;
  },
});

export const addMemberToGroup = mutation({
  args: { 
    groupId: v.id("groups"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new Error("Not authenticated");

    // Check if current user is admin
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) => 
        q.eq("groupId", args.groupId).eq("userId", currentUserId)
      )
      .first();

    if (!membership || membership.role !== "admin") {
      throw new Error("Только админ может добавить пользователей");
    }

    // Check if user is already a member
    const existingMembership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) => 
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .first();

    if (existingMembership) {
      throw new Error("Этот пользователь уже участник группы");
    }

    // Check if the user being added is a friend
    const friendship = await ctx.db
      .query("userRelationships")
      .withIndex("by_user_and_target", (q) => 
        q.eq("userId", currentUserId).eq("targetUserId", args.userId)
      )
      .filter((q) => 
        q.and(
          q.eq(q.field("type"), "friend"),
          q.eq(q.field("status"), "accepted")
        )
      )
      .first();

    if (!friendship) {
      throw new Error("Можно добавить только друзей");
    }

    await ctx.db.insert("groupMembers", {
      groupId: args.groupId,
      userId: args.userId,
      role: "member",
      joinedAt: Date.now(),
    });
  },
});

export const removeMemberFromGroup = mutation({
  args: { 
    groupId: v.id("groups"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new Error("Not authenticated");

    // Check if current user is admin
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) => 
        q.eq("groupId", args.groupId).eq("userId", currentUserId)
      )
      .first();

    if (!membership || membership.role !== "admin") {
      throw new Error("Only admins can remove members");
    }

    // Find the member to remove
    const memberToRemove = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) => 
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .first();

    if (!memberToRemove) {
      throw new Error("User is not a member of this group");
    }

    // Don't allow removing the group creator
    const group = await ctx.db.get(args.groupId);
    if (group?.createdBy === args.userId) {
      throw new Error("Cannot remove group creator");
    }

    await ctx.db.delete(memberToRemove._id);
  },
});

export const leaveGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) => 
        q.eq("groupId", args.groupId).eq("userId", userId)
      )
      .first();

    if (!membership) {
      throw new Error("Not a member of this group");
    }

    // Don't allow group creator to leave
    const group = await ctx.db.get(args.groupId);
    if (group?.createdBy === userId) {
      throw new Error("Group creator cannot leave the group");
    }

    await ctx.db.delete(membership._id);
  },
});

export const getUserGroups = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const groups = await Promise.all(
      memberships.map(async (membership) => {
        const group = await ctx.db.get(membership.groupId);
        if (!group) return null;

        // Get member count
        const memberCount = await ctx.db
          .query("groupMembers")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .collect();

        return {
          ...group,
          role: membership.role,
          memberCount: memberCount.length,
        };
      })
    );

    return groups.filter(Boolean);
  },
});

export const getGroupMembers = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if user is a member
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) => 
        q.eq("groupId", args.groupId).eq("userId", userId)
      )
      .first();

    if (!membership) {
      throw new Error("Not a member of this group");
    }

    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        if (!user) return null;

        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .first();

        let profilePhotoUrl = null;
        if (profile?.profilePhotoId) {
          profilePhotoUrl = await ctx.storage.getUrl(profile.profilePhotoId);
        }

        return {
          _id: user._id,
          name: user.name,
          nickname: profile?.nickname,
          email: user.email,
          role: membership.role,
          joinedAt: membership.joinedAt,
          profilePhotoUrl,
        };
      })
    );

    return members.filter(Boolean);
  },
});

export const getAvailableFriendsForGroup = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");


    // Get all friends
    const friendships = await ctx.db
      .query("userRelationships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => 
        q.and(
          q.eq(q.field("type"), "friend"),
          q.eq(q.field("status"), "accepted")
        )
      )
      .collect();

    // Get current group members
    const groupMembers = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    const memberIds = new Set(groupMembers.map(m => m.userId));

    // Filter friends who are not already in the group
    const availableFriends = await Promise.all(
      friendships
        .filter(friendship => !memberIds.has(friendship.targetUserId))
        .map(async (friendship) => {
          const user = await ctx.db.get(friendship.targetUserId);
          if (!user) return null;

          const profile = await ctx.db
            .query("userProfiles")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .first();

          let profilePhotoUrl = null;
          if (profile?.profilePhotoId) {
            profilePhotoUrl = await ctx.storage.getUrl(profile.profilePhotoId);
          }

          return {
            _id: user._id,
            name: user.name,
            nickname: profile?.nickname,
            email: user.email,
            profilePhotoUrl,
          };
        })
    );

    return availableFriends.filter(Boolean);
  },
});
