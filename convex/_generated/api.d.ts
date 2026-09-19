/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as judge from "../judge.js";
import type * as lib_admin from "../lib/admin.js";
import type * as lib_counters from "../lib/counters.js";
import type * as lib_heldTerms from "../lib/heldTerms.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_safeWords from "../lib/safeWords.js";
import type * as lib_typesafe from "../lib/typesafe.js";
import type * as lib_words from "../lib/words.js";
import type * as messages from "../messages.js";
import type * as questions from "../questions.js";
import type * as stats from "../stats.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  judge: typeof judge;
  "lib/admin": typeof lib_admin;
  "lib/counters": typeof lib_counters;
  "lib/heldTerms": typeof lib_heldTerms;
  "lib/pricing": typeof lib_pricing;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/safeWords": typeof lib_safeWords;
  "lib/typesafe": typeof lib_typesafe;
  "lib/words": typeof lib_words;
  messages: typeof messages;
  questions: typeof questions;
  stats: typeof stats;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  shardedCounter: import("@convex-dev/sharded-counter/_generated/component.js").ComponentApi<"shardedCounter">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  auth: import("@convex-dev/auth/core/_generated/component.js").ComponentApi<"auth">;
  authPasswordProvider: import("@convex-dev/auth/providers/password/_generated/component.js").ComponentApi<"authPasswordProvider">;
  authUsername: import("@convex-dev/auth/username/_generated/component.js").ComponentApi<"authUsername">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
