import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

// Two layers, both five a minute.
// ip: fixed window per caller IP, so minting fresh session ids buys nothing.
// post: token bucket per browser session, three in a quick burst.
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  ip: { kind: "fixed window", rate: 5, period: MINUTE },
  post: { kind: "token bucket", rate: 5, period: MINUTE, capacity: 3 },
});
