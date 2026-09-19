// Server only. Topics the wall does not host, read from the deployment's
// HELD_TERMS environment variable as a comma separated list of lowercase
// words or short phrases. Nothing here ships to the browser and the list is
// not in the repo. A match is stored as blocked without calling Jev, so the
// poster sees the same "Held back by Jev" line as any other held post.
//
// Only terms whose every word is on the safe list can ever reach this
// check, because parseMessage rejects the rest first. Keep the list to
// those; anything else is dead weight against the 8 KiB env value cap.

function terms(): Array<string> {
  const raw = process.env.HELD_TERMS ?? "";
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, " "))
    .filter((t) => t.length > 0);
}

// `text` is the normalized post: lowercase words joined by single spaces.
// Whole word or whole phrase match on word boundaries. No substring pass:
// it read "eat out" inside "great outdoors", and spaced obfuscation cannot
// pass the allowlist anyway.
export function isHeldTopic(text: string): boolean {
  const list = terms();
  if (list.length === 0) return false;
  const padded = ` ${text} `;
  return list.some((t) => padded.includes(` ${t} `));
}
