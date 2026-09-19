// Anonymous browser session. No accounts on a public wall. The id is used
// for rate limiting and for showing you your own posts as they get judged.

const KEY = "ftm.session";

export function getSessionId(): string {
  const existing = window.localStorage.getItem(KEY);
  if (existing && existing.length >= 8) {
    return existing;
  }
  const fresh = crypto.randomUUID();
  window.localStorage.setItem(KEY, fresh);
  return fresh;
}
