import { useEffect, useState, type MouseEvent } from "react";

// A few pages, one static host that serves index.html for every path. This
// is all the routing the app needs: read the pathname, re render when it
// changes, and let links push instead of reload so the Convex socket and
// the auth session stay warm.

const EVENT = "ask-jev:navigate";

function currentPath(): string {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

export function navigate(path: string) {
  if (currentPath() === path) return;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event(EVENT));
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener("popstate", onChange);
    window.addEventListener(EVENT, onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener(EVENT, onChange);
    };
  }, []);
  return path;
}

export type Route =
  | { name: "home" }
  | { name: "admin" }
  | { name: "about" }
  | { name: "terms" }
  | { name: "privacy" }
  | { name: "signIn" }
  | { name: "signUp" }
  | { name: "me" }
  | { name: "profile"; handle: string }
  | { name: "ask"; id: string }
  | { name: "notFound" };

// Pathname to route. Anything unknown is not found rather than home, so a
// typo does not quietly show the wall. Profiles live at /:handle, matched
// last, after every page; the server refuses to allocate a handle that
// spells a page (RESERVED_HANDLES in convex/lib/auth.ts), so the two can
// never collide. /u/:handle and /docs are old addresses and still resolve.
export function parseRoute(path: string): Route {
  if (path === "/") return { name: "home" };
  if (path === "/admin") return { name: "admin" };
  if (path === "/about" || path === "/docs") return { name: "about" };
  if (path === "/terms") return { name: "terms" };
  if (path === "/privacy") return { name: "privacy" };
  if (path === "/sign-in") return { name: "signIn" };
  if (path === "/sign-up") return { name: "signUp" };
  if (path === "/me") return { name: "me" };
  const ask = path.match(/^\/a\/([a-z0-9]+)$/i);
  if (ask) return { name: "ask", id: ask[1]! };
  const profile = path.match(/^\/(?:u\/)?([a-z0-9_]{3,20})$/i);
  if (profile) return { name: "profile", handle: profile[1]!.toLowerCase() };
  return { name: "notFound" };
}

// Canonical address of a profile.
export function profilePath(handle: string): string {
  return `/${handle}`;
}

export function useRoute(): Route {
  return parseRoute(usePath());
}

// Click handler for in app anchors. Plain left clicks push; modified
// clicks and middle clicks keep the browser's own behavior.
export function onLinkClick(event: MouseEvent<HTMLAnchorElement>) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  const href = event.currentTarget.getAttribute("href");
  if (!href || !href.startsWith("/") || href.startsWith("//")) return;
  event.preventDefault();
  navigate(href);
  window.scrollTo({ top: 0 });
}
