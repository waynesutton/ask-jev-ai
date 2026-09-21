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
import type * as answer from "../answer.js";
import type * as auth from "../auth.js";
import type * as judge from "../judge.js";
import type * as lib_admin from "../lib/admin.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_counters from "../lib/counters.js";
import type * as lib_heldTerms from "../lib/heldTerms.js";
import type * as lib_jev from "../lib/jev.js";
import type * as lib_limits from "../lib/limits.js";
import type * as lib_oauth from "../lib/oauth.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_safeWords from "../lib/safeWords.js";
import type * as lib_typesafe from "../lib/typesafe.js";
import type * as lib_usage from "../lib/usage.js";
import type * as lib_words from "../lib/words.js";
import type * as messages from "../messages.js";
import type * as migrations from "../migrations.js";
import type * as profile from "../profile.js";
import type * as questions from "../questions.js";
import type * as stats from "../stats.js";
import type * as users from "../users.js";
import type * as votes from "../votes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  answer: typeof answer;
  auth: typeof auth;
  judge: typeof judge;
  "lib/admin": typeof lib_admin;
  "lib/auth": typeof lib_auth;
  "lib/counters": typeof lib_counters;
  "lib/heldTerms": typeof lib_heldTerms;
  "lib/jev": typeof lib_jev;
  "lib/limits": typeof lib_limits;
  "lib/oauth": typeof lib_oauth;
  "lib/pricing": typeof lib_pricing;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/safeWords": typeof lib_safeWords;
  "lib/typesafe": typeof lib_typesafe;
  "lib/usage": typeof lib_usage;
  "lib/words": typeof lib_words;
  messages: typeof messages;
  migrations: typeof migrations;
  profile: typeof profile;
  questions: typeof questions;
  stats: typeof stats;
  users: typeof users;
  votes: typeof votes;
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
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  auth: import("@convex-dev/auth/core/_generated/component.js").ComponentApi<"auth">;
  authPasswordProvider: import("@convex-dev/auth/providers/password/_generated/component.js").ComponentApi<"authPasswordProvider">;
  authUsername: import("@convex-dev/auth/username/_generated/component.js").ComponentApi<"authUsername">;
  oauthGoogle: import("@convex-dev/auth/providers/oauth/_generated/component.js").ComponentApi<"oauthGoogle">;
  oauthGithub: import("@convex-dev/auth/providers/oauth/_generated/component.js").ComponentApi<"oauthGithub">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
