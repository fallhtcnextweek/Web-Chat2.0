import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    
    const user = await ctx.db.get(userId);
    if (!user) return null;

    // Get user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    let profilePhotoUrl = null;
    if (profile?.profilePhotoId) {
      profilePhotoUrl = await ctx.storage.getUrl(profile.profilePhotoId);
    }

    return {
      ...user,
      nickname: profile?.nickname,
      profilePhotoId: profile?.profilePhotoId,
      profilePhotoUrl,
    };
  },
});

export const updateProfile = mutation({
  args: { 
    nickname: v.optional(v.string()),
    profilePhotoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if profile exists
    let profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (profile) {
      // Update existing profile
      const updates: any = {};
      if (args.nickname !== undefined) {
        updates.nickname = args.nickname;
      }
      if (args.profilePhotoId !== undefined) {
        updates.profilePhotoId = args.profilePhotoId;
      }
      await ctx.db.patch(profile._id, updates);
    } else {
      // Create new profile
      await ctx.db.insert("userProfiles", {
        userId,
        nickname: args.nickname,
        profilePhotoId: args.profilePhotoId,
      });
    }
  },
});

export const searchUsers = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Search by nickname in profiles
    const profiles = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("nickname"), args.query))
      .take(10);

    const usersWithPhotos = await Promise.all(
      profiles.map(async (profile) => {
        const user = await ctx.db.get(profile.userId);
        if (!user || user._id === userId) return null;

        let profilePhotoUrl = null;
        if (profile.profilePhotoId) {
          profilePhotoUrl = await ctx.storage.getUrl(profile.profilePhotoId);
        }

        return {
          _id: user._id,
          name: user.name,
          nickname: profile.nickname,
          email: user.email,
          profilePhotoUrl,
        };
      })
    );

    return usersWithPhotos.filter(Boolean);
  },
});

export const sendFriendRequest = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

   

    await ctx.db.insert("userRelationships", {
      userId,
      targetUserId: args.targetUserId,
      type: "friend",
      status: "pending",
    });
  },
});

export const respondToFriendRequest = mutation({
  args: { 
    relationshipId: v.id("userRelationships"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Не авторизован");

    const relationship = await ctx.db.get(args.relationshipId);
    if (!relationship || relationship.targetUserId !== userId) {
      throw new Error("Ошибка отправки заяввки");
    }

    if (args.accept) {
      await ctx.db.patch(args.relationshipId, { status: "accepted" });
      
      // Create reciprocal relationship
      await ctx.db.insert("userRelationships", {
        userId: relationship.targetUserId,
        targetUserId: relationship.userId,
        type: "friend",
        status: "accepted",
      });
    } else {
      await ctx.db.patch(args.relationshipId, { status: "rejected" });
    }
  },
});

export const blockUser = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Не авторизован");

    // Remove any existing friend relationship
    const existingFriend = await ctx.db
      .query("userRelationships")
      .withIndex("by_user_and_target", (q) => 
        q.eq("userId", userId).eq("targetUserId", args.targetUserId)
      )
      .first();

    if (existingFriend) {
      await ctx.db.delete(existingFriend._id);
    }

    // Add block relationship
    await ctx.db.insert("userRelationships", {
      userId,
      targetUserId: args.targetUserId,
      type: "blocked",
      status: "accepted",
    });
  },
});

export const getFriends = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const relationships = await ctx.db
      .query("userRelationships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => 
        q.and(
          q.eq(q.field("type"), "friend"),
          q.eq(q.field("status"), "accepted")
        )
      )
      .collect();

    const friends = await Promise.all(
      relationships.map(async (rel) => {
        const user = await ctx.db.get(rel.targetUserId);
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

    return friends.filter(Boolean);
  },
});

export const getPendingRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const requests = await ctx.db
      .query("userRelationships")
      .withIndex("by_target", (q) => q.eq("targetUserId", userId))
      .filter((q) => 
        q.and(
          q.eq(q.field("type"), "friend"),
          q.eq(q.field("status"), "pending")
        )
      )
      .collect();

    const requestsWithUsers = await Promise.all(
      requests.map(async (req) => {
        const user = await ctx.db.get(req.userId);
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
          _id: req._id,
          user: {
            _id: user._id,
            name: user.name,
            nickname: profile?.nickname,
            email: user.email,
            profilePhotoUrl,
          },
        };
      })
    );

    return requestsWithUsers.filter(Boolean);
  },
});
