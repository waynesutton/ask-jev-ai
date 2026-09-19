import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { adminUsername, normalizeUsername } from "./lib/admin";

// Called by Convex Auth the first time a username signs up. This is the
// gate: anything other than ADMIN_USERNAME is refused, so the deployment's
// environment decides who the one account belongs to.
export const createUser = internalMutation({
  args: {
    provider: v.object({
      name: v.literal("password"),
      accountId: v.string(),
      profile: v.object({ username: v.string() }),
    }),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const username = normalizeUsername(args.provider.profile.username);
    const admin = adminUsername();
    if (!admin || username !== admin) {
      throw new ConvexError("Sign up is closed");
    }
    return await ctx.db.insert("users", { username });
  },
});
