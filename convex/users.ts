import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { adminUsername, normalizeUsername, signupOpen } from "./lib/admin";

// Called by Convex Auth the first time a username signs up. Three gates,
// all server side: the window must be open (ADMIN_SIGNUP_OPEN=1), no
// account may exist yet, and the username must equal ADMIN_USERNAME. The
// window keeps a stranger who guesses the admin email from registering it
// first; the one row rule keeps the table at one account, ever.
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
    if (!signupOpen()) {
      throw new ConvexError("Sign up is closed");
    }
    const existing = await ctx.db.query("users").first();
    if (existing) {
      throw new ConvexError("Sign up is closed");
    }
    const username = normalizeUsername(args.provider.profile.username);
    const admin = adminUsername();
    if (!admin || username !== admin) {
      throw new ConvexError("Sign up is closed");
    }
    return await ctx.db.insert("users", { username });
  },
});
