import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/core";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

// Usernames are emails here. Compare them the way people type them.
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

// The one allowed admin, from the deployment's environment. Unset means
// nobody can sign up and nobody passes requireAdmin.
export function adminUsername(): string | null {
  const raw = process.env.ADMIN_USERNAME;
  return raw ? normalizeUsername(raw) : null;
}

// Signed in and matches ADMIN_USERNAME. Both must hold: a valid session
// alone is not enough, the env var is the allowlist.
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Not signed in");
  }
  const user = await ctx.db.get(userId);
  const admin = adminUsername();
  if (!user || !admin || user.username !== admin) {
    throw new ConvexError("Not authorized");
  }
  return user;
}
