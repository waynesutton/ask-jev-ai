import { useEffect } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMe } from "../hooks/useMe";
import { navigate } from "../lib/router";
import { safeNextPath } from "../lib/oauth";
import { AuthForm } from "./AuthForm";
import { Link } from "./Link";
import { ThemeToggle } from "./ThemeToggle";
import { USER_POSTS_PER_MINUTE } from "../../convex/lib/limits";

// Where to go after. `?next=/a/abc` comes from a "Sign in to ask follow up
// questions" link, so the person lands back on the ask they were reading.
// Only same origin paths are honored; anything else is home.
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return safeNextPath(next, window.location.origin);
}

// /sign-in and /sign-up. One page, one form, the other verb one click
// away. A signed in visitor is sent home, or back to `next`.
export function SignIn({ mode }: { mode: "in" | "up" }) {
  const me = useMe();
  const gate = useQuery(api.admin.me);
  const next = nextPath();
  // The other verb keeps the return address.
  const query = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;

  useEffect(() => {
    document.title = mode === "in" ? "Sign in · Ask Jev" : "Sign up · Ask Jev";
  }, [mode]);

  useEffect(() => {
    if (me) navigate(next);
  }, [me, next]);

  return (
    <main className="admin">
      <div className="wrap hero__top label">
        <Link className="admin__back" href="/">
          <ArrowLeft size={11} aria-hidden="true" /> Back to the wall
        </Link>
        <ThemeToggle />
      </div>
      <section className="wrap admin__body">
        <AuthForm
          next={next}
          mode={mode}
          eyebrow="Account"
          heading={mode === "in" ? "Sign in." : "Create an account."}
          note={
            mode === "up" ? (
              <p className="body-sm muted">
                An account lets you ask longer, open questions and get a short
                answer from a model Jev picks. Follow up on any ask on the
                wall in a thread only you and the admin can read. Keep asks
                private or put them on the wall. {USER_POSTS_PER_MINUTE} a
                minute instead of five.
                {gate?.signupOpen && (
                  <>
                    {" "}
                    The admin sign up window is open: the admin email can
                    register now.
                  </>
                )}
              </p>
            ) : undefined
          }
          other={
            mode === "in"
              ? { href: `/sign-up${query}`, label: "Create an account" }
              : { href: `/sign-in${query}`, label: "I have an account" }
          }
          onDone={() => navigate(next)}
        />
      </section>
    </main>
  );
}
