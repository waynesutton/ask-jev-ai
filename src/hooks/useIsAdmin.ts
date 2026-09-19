import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";

// True only when a session is signed in and matches ADMIN_USERNAME on the
// deployment. Visitors never run the query; the server still re-checks on
// every admin mutation, so this only decides what to render.
export function useIsAdmin(): boolean {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.admin.me, isAuthenticated ? {} : "skip");
  return me?.admin ?? false;
}
