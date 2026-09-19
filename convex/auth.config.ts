import type { AuthConfig } from "convex/server";

// Convex verifies session tokens against the JWKS the auth component serves
// from this deployment. No third party involved.
export default {
  providers: [
    {
      type: "customJwt",
      applicationID: "convex",
      issuer: process.env.CONVEX_SITE_URL!,
      jwks: `${process.env.CONVEX_SITE_URL}/auth/.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
