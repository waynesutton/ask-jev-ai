import { components, internal } from "./_generated/api";
import { setupCore } from "@convex-dev/auth/core/setup";
import { setupUsernamePassword } from "@convex-dev/auth/providers/password/setup";
import { setupGoogle } from "@convex-dev/auth/providers/oauth/google";
import { setupGithub } from "@convex-dev/auth/providers/oauth/github";
import { env } from "./_generated/server";
import { oauthRedirectOrigins } from "./lib/oauth";

// Session plumbing the client needs: refresh, sign out, and an auth check.
const core = setupCore({ component: components.auth });
export const { signOut, refreshSession, isAuthenticated } = core;

// Username + password. Sign up runs through users.createUser, which
// allocates the user number and handle and guards the admin email.
// changePassword serves the settings page.
export const { signUpWithPassword, signInWithPassword, changePassword } =
  setupUsernamePassword(core, {
    component: components.authPasswordProvider,
    usernameComponent: components.authUsername,
  }).attachUserCallbacks({ createUser: internal.users.createUser });

const allowedRedirectOrigins = oauthRedirectOrigins(
  env.CONVEX_SITE_URL,
  env.AUTH_ALLOWED_ORIGINS,
);

export const { startSignInGoogle, completeSignInGoogle } = setupGoogle(core, {
  component: components.oauthGoogle,
  allowedRedirectOrigins,
}).attachUserCallbacks({
  createUser: internal.users.createUserGoogle,
  onSignIn: internal.users.onSignInGoogle,
});

export const { startSignInGithub, completeSignInGithub } = setupGithub(core, {
  component: components.oauthGithub,
  allowedRedirectOrigins,
}).attachUserCallbacks({
  createUser: internal.users.createUserGithub,
  onSignIn: internal.users.onSignInGithub,
});
