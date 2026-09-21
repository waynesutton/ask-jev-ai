import { useOauth } from "@convex-dev/auth/providers/oauth/react";
import { oauthErrorMessage } from "../lib/oauth";

// OAuth can return to any page, so errors must be visible outside the form.
export function OauthError() {
  const { flowError } = useOauth();
  if (!flowError) return null;
  return (
    <p className="oauth-error body-sm" role="alert">
      {oauthErrorMessage(flowError)}
    </p>
  );
}
