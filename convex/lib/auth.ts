import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/core";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { adminUsername } from "./admin";

// Account standing with the default applied. Rows from before moderation
// existed have no status and count as active.
export function userStatus(
  user: Doc<"users">,
): "active" | "paused" | "blocked" {
  return user.status ?? "active";
}

// Whether this row is the admin. Read time, from the env var, so the role
// follows ADMIN_USERNAME and is never stored.
export function isAdminUser(user: Doc<"users">): boolean {
  const admin = adminUsername();
  return admin !== null && user.username === admin;
}

// The signed in user, or null for a visitor. Never throws, so queries that
// serve both audiences can branch on it.
export async function getOptionalUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get(userId);
}

// Signed in and not blocked. Blocked accounts keep a valid auth session
// (the alpha has no revoke API) so every app call refuses them here.
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await getOptionalUser(ctx);
  if (!user) {
    throw new ConvexError("Not signed in");
  }
  if (userStatus(user) === "blocked") {
    throw new ConvexError("Account blocked");
  }
  return user;
}

// Signed in, not blocked, not paused. Gates writes: posting, follow ups,
// profile edits. Reads and exports use requireUser so a paused account
// can still see and take its data.
export async function requireActiveUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (userStatus(user) === "paused") {
    throw new ConvexError("Account paused");
  }
  return user;
}

// Next value for a named counter. Exact, not sharded: user numbers must
// never repeat or skip.
export async function nextSequence(
  ctx: MutationCtx,
  key: string,
): Promise<number> {
  const row = await ctx.db
    .query("sequences")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (!row) {
    await ctx.db.insert("sequences", { key, value: 1 });
    return 1;
  }
  const value = row.value + 1;
  await ctx.db.patch(row._id, { value });
  return value;
}

// Handles: lowercase letters, digits, underscore, three to twenty long.
export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

// Profiles live at /:handle, so a handle can never be a page. Pages with a
// hyphen (sign-in) cannot match HANDLE_RE anyway; these are the ones that
// could. A few extras are held back for pages that may come later.
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "admin",
  "terms",
  "privacy",
  "docs",
  "how",
  "wall",
  "api",
  "assets",
  "ask",
  "asks",
  "jev",
  "convex",
  "typesafe",
  "about",
  "help",
  "login",
  "logout",
  "signin",
  "signup",
  "settings",
  "account",
  "profile",
  "search",
  "static",
  "www",
  "root",
  "system",
  "support",
  "status",
  "blog",
  "null",
  "undefined",
]);

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle);
}

// A starter handle from an email's local part, unique by numeric suffix.
export async function allocateHandle(
  ctx: MutationCtx,
  email: string,
  exclude?: Id<"users">,
): Promise<string> {
  const local = email.split("@")[0] ?? "";
  let base = local
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 16);
  if (base.length < 3) base = `user${base}`.slice(0, 16);
  let candidate = base;
  for (let n = 2; n < 10_000; n++) {
    const taken = isReservedHandle(candidate)
      ? true
      : await ctx.db
          .query("users")
          .withIndex("by_handle", (q) => q.eq("handle", candidate))
          .unique();
    if (!taken || (taken !== true && taken._id === exclude)) return candidate;
    candidate = `${base}${n}`.slice(0, 20);
  }
  throw new ConvexError("Could not allocate a handle");
}
