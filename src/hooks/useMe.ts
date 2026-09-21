import { useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

export type Me = NonNullable<FunctionReturnType<typeof api.profile.me>>;

// The signed in account, or null for a visitor, or undefined while the
// session and the query settle. Visitors never run the query.
export function useMe(): Me | null | undefined {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.profile.me, isAuthenticated ? {} : "skip");
  if (isLoading) return undefined;
  if (!isAuthenticated) return null;
  return me;
}
