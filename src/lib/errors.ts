import { ConvexError } from "convex/values";

// What to show a person when a Convex call fails.
//
// Server code throws `ConvexError("plain sentence")` for anything the user
// can act on (a taken handle, a bad link). That sentence travels in
// `error.data`. On production `error.message` is replaced with
// "[CONVEX M(fn)] [Request ID: ...] Server Error", so reading `.message`
// shows people the raw wrapper. Read `.data` instead.
//
// Anything else (a bug, a limit, a network drop) gets the fallback and the
// raw error goes to the console with its request id, which is what the
// Convex dashboard logs are keyed on.
export function userMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data;
  }
  console.error("[askjev] unexpected error", error);
  return fallback;
}
