import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

// Anonymous posting, two layers, both five a minute.
// ip: fixed window per caller IP, so minting fresh session ids buys nothing.
// post: token bucket per browser session, three in a quick burst.
//
// Signed in posting is keyed by user id and lifted to twenty a minute with
// a burst of ten. The IP layer still applies, at the higher signed in rate,
// so one account cannot script the wall from a farm of sessions.
//
// Model answers cost real money, so they carry their own budget per user:
// a minute bucket for bursts and a daily bucket as the ceiling.
import {
  ANON_POSTS_PER_MINUTE,
  ANSWERS_PER_DAY,
  USER_POSTS_PER_MINUTE,
} from "./limits";

export { ANON_POSTS_PER_MINUTE, ANSWERS_PER_DAY, USER_POSTS_PER_MINUTE };

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  ip: { kind: "fixed window", rate: ANON_POSTS_PER_MINUTE, period: MINUTE },
  post: {
    kind: "token bucket",
    rate: ANON_POSTS_PER_MINUTE,
    period: MINUTE,
    capacity: 3,
  },
  userIp: {
    kind: "fixed window",
    rate: USER_POSTS_PER_MINUTE,
    period: MINUTE,
  },
  userPost: {
    kind: "token bucket",
    rate: USER_POSTS_PER_MINUTE,
    period: MINUTE,
    capacity: 10,
  },
  answer: { kind: "token bucket", rate: 12, period: MINUTE, capacity: 6 },
  // "Was Jev right?" votes, keyed by user id or session id. Cheap writes,
  // but a burst of thirty a minute is still a script, not a reader.
  vote: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 10 },
  answerDaily: {
    kind: "fixed window",
    rate: ANSWERS_PER_DAY,
    period: 24 * HOUR,
  },
});
