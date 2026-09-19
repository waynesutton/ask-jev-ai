import { components, internal } from "./_generated/api";
import { setupCore } from "@convex-dev/auth/core/setup";
import { setupUsernamePassword } from "@convex-dev/auth/providers/password/setup";

// Session plumbing the client needs: refresh, sign out, and an auth check.
const core = setupCore({ component: components.auth });
export const { signOut, refreshSession, isAuthenticated } = core;

// Username + password. Sign up runs through users.createUser, which only
// accepts the admin username from the deployment's environment.
export const { signUpWithPassword, signInWithPassword } = setupUsernamePassword(
  core,
  {
    component: components.authPasswordProvider,
    usernameComponent: components.authUsername,
  },
).attachUserCallbacks({ createUser: internal.users.createUser });
