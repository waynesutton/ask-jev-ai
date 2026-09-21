import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { adminUsername, normalizeUsername } from "./admin";
import { allocateHandle, nextSequence } from "./auth";

type OauthProvider = "google" | "github";
type OauthIdentity = { email?: string; emailVerified: boolean; name?: string };

// Only provider-verified emails may identify an app account.
async function checkedEmail(ctx: MutationCtx, identity: OauthIdentity) {
  const username = normalizeUsername(identity.email ?? "");
  if (!username || identity.emailVerified !== true) {
    throw new ConvexError(
      "Sign in with an account that has a verified email, or use email and password",
    );
  }
  if (username === adminUsername()) {
    throw new ConvexError("This email signs in with a password");
  }
  const blocked = await ctx.db
    .query("blockedEmails")
    .withIndex("by_email", (q) => q.eq("email", username))
    .unique();
  if (blocked) throw new ConvexError("This email cannot sign up");
  return username;
}

export async function createOauthUser(
  ctx: MutationCtx,
  identity: OauthIdentity,
  provider: OauthProvider,
): Promise<Id<"users">> {
  const username = await checkedEmail(ctx, identity);
  const existing = await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", username))
    .unique();
  if (existing) {
    if (existing.status === "blocked") {
      throw new ConvexError("This email cannot sign up");
    }
    const providers = existing.providers ?? ["password"];
    if (!providers.includes(provider)) {
      await ctx.db.patch(existing._id, { providers: [...providers, provider] });
    }
    return existing._id;
  }
  const userNumber = await nextSequence(ctx, "users");
  const handle = await allocateHandle(ctx, username);
  return await ctx.db.insert("users", {
    username,
    providers: [provider],
    handle,
    userNumber,
    displayName: identity.name?.trim().slice(0, 40) || undefined,
    publicProfile: false,
    status: "active",
  });
}

// createUser runs once per provider account. Recheck each return visit
// before issuing a session, including a deleted or newly blocked account.
export async function checkOauthSignIn(
  ctx: MutationCtx,
  identity: OauthIdentity,
  userId: Id<"users">,
): Promise<null> {
  const username = await checkedEmail(ctx, identity);
  const user = await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", username))
    .unique();
  if (!user || user._id !== userId) {
    throw new ConvexError(
      "This sign in no longer matches an account. Contact support",
    );
  }
  if (user.status === "blocked") {
    throw new ConvexError("This email cannot sign up");
  }
  return null;
}

// Bare origins only. Reject credentials, paths and wildcards instead of
// quietly widening the redirect allowlist.
export function oauthRedirectOrigins(site: string, extra = ""): string[] {
  const values = [
    site,
    ...extra
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];
  return [
    ...new Set(
      values.map((value) => {
        const url = new URL(value);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password ||
          url.pathname !== "/" ||
          url.search ||
          url.hash ||
          url.hostname.includes("*")
        ) {
          throw new Error(
            "OAuth return addresses must be exact HTTP(S) origins",
          );
        }
        return url.origin;
      }),
    ),
  ];
}
