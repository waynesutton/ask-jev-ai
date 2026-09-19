// Anonymous browser session. No accounts on a public wall. The id is used
// for rate limiting and for showing you your own posts as they get judged.

const KEY = "ftm.session";

// Matches the floor `messages.send` enforces. A UUID is 36 characters, so
// anything shorter is stale or tampered and gets replaced.
const MIN_LENGTH = 32;

export function getSessionId(): string {
  const existing = window.localStorage.getItem(KEY);
  if (existing && existing.length >= MIN_LENGTH) {
    return existing;
  }
  const fresh = crypto.randomUUID();
  window.localStorage.setItem(KEY, fresh);
  return fresh;
}
