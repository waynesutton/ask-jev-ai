import type { OauthFlowError } from "@convex-dev/auth/providers/oauth/react";

// Keep return paths on this origin, including their query and follow-up hash.
export function safeNextPath(next: string | null, origin: string): string {
  if (
    !next?.startsWith("/") ||
    next.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(next)
  )
    return "/";
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function oauthErrorMessage(error: OauthFlowError): string {
  switch (error.code) {
    case "access_denied":
      return "You cancelled the sign in";
    case "expired":
      return "That took too long. Try again";
    case "rejected":
      return error.message || "This account cannot sign in";
    case "oauth_error":
      return "Could not reach the provider. Try again";
    case "invalid_flow":
      return "That sign in link is stale. Start again";
  }
}
