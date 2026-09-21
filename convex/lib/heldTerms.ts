// Server only. Topics the wall does not host, read from the deployment's
// HELD_TERMS environment variable as a comma separated list of lowercase
// words or short phrases. Nothing here ships to the browser and the list is
// not in the repo.
//
// Two outcomes, by who asked:
//   anonymous: stored as blocked without calling Jev, so the poster sees
//     the same "Held back by Jev" line as any other held post.
//   signed in: the ask goes through. Jev judges it, a model answers it,
//     and the wall shows it blurred to everyone but the owner and the admin.
//
// Anonymous text has already passed the allowlist, so only safe list words
// can reach this check from that path. Keep the list to those; anything
// else is dead weight against the 8 KiB env value cap.

function terms(): Array<string> {
  const raw = process.env.HELD_TERMS ?? "";
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, " "))
    .filter((t) => t.length > 0);
}

// Lowercase, punctuation to spaces, one space between words. Anonymous
// posts arrive in this shape already; signed in asks keep their commas and
// question marks and get normalized here so "eat out?" still reads as
// "eat out".
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Whole word or whole phrase match on word boundaries. No substring pass:
// it read "eat out" inside "great outdoors", and spaced obfuscation cannot
// pass the allowlist anyway.
export function isHeldTopic(text: string): boolean {
  const list = terms();
  if (list.length === 0) return false;
  const padded = ` ${normalize(text)} `;
  return list.some((t) => padded.includes(` ${t} `));
}
