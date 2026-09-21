import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { adminUsername, normalizeUsername, signupOpen } from "./lib/admin";
import { allocateHandle, nextSequence } from "./lib/auth";
import { vGoogleProfile } from "@convex-dev/auth/providers/oauth/google";
import { vGithubProfile } from "@convex-dev/auth/providers/oauth/github";
import { checkOauthSignIn, createOauthUser } from "./lib/oauth";

// Called by Convex Auth the first time a username signs up. Anyone can
// create an account, with two server side gates:
//   1. The admin email needs ADMIN_SIGNUP_OPEN=1, so a stranger who guesses
//      it cannot register it first. Once the admin row exists the username
//      component refuses the duplicate on its own.
//   2. Emails the admin blocked cannot come back.
// Every new account gets the next user number and a starter handle.
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
    if (admin !== null && username === admin && !signupOpen()) {
      throw new ConvexError("Sign up is closed for this email");
    }
    const blocked = await ctx.db
      .query("blockedEmails")
      .withIndex("by_email", (q) => q.eq("email", username))
      .unique();
    if (blocked) {
      throw new ConvexError("This email cannot sign up");
    }
    // An OAuth-only account has no password username entry. A new password
    // must never create a duplicate or grant access to that existing account.
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (existing) throw new ConvexError("Use your existing sign in method");
    const userNumber = await nextSequence(ctx, "users");
    const handle = await allocateHandle(ctx, username);
    return await ctx.db.insert("users", {
      username,
      providers: ["password"],
      handle,
      userNumber,
      publicProfile: false,
      status: "active",
    });
  },
});

const googleProvider = v.object({
  name: v.literal("google"),
  accountId: v.string(),
  profile: vGoogleProfile,
});
const githubProvider = v.object({
  name: v.literal("github"),
  accountId: v.string(),
  profile: vGithubProfile,
});

export const createUserGoogle = internalMutation({
  args: { provider: googleProvider },
  returns: v.id("users"),
  handler: (ctx, { provider }) => createOauthUser(ctx, provider.profile, "google"),
});

export const createUserGithub = internalMutation({
  args: { provider: githubProvider },
  returns: v.id("users"),
  handler: (ctx, { provider }) => createOauthUser(ctx, provider.profile, "github"),
});

export const onSignInGoogle = internalMutation({
  args: { provider: googleProvider, userId: v.id("users") },
  returns: v.null(),
  handler: (ctx, { provider, userId }) => checkOauthSignIn(ctx, provider.profile, userId),
});

export const onSignInGithub = internalMutation({
  args: { provider: githubProvider, userId: v.id("users") },
  returns: v.null(),
  handler: (ctx, { provider, userId }) => checkOauthSignIn(ctx, provider.profile, userId),
});
