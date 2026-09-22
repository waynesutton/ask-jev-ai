import { Link } from "./Link";
import { Tooltip } from "./Tooltip";

// Sign up (ghost) and Sign in (pill) for a visitor. Shared by the home page
// top row and any public page a visitor can land on from a shared link,
// such as a profile. `next` is where sign in or sign up returns to; the
// auth pages only honor same origin paths.
export function AuthLinks({ next }: { next?: string }) {
  const query =
    next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <span className="account__auth">
      <Tooltip tip="Google, GitHub, or email. Free. 20 asks a minute, model answers, a profile">
        <Link className="ghost account__signup" href={`/sign-up${query}`}>
          Sign up
        </Link>
      </Tooltip>
      <Tooltip tip="Ask longer questions, get model answers, keep a history">
        <Link className="pill pill--small account__signin" href={`/sign-in${query}`}>
          Sign in
        </Link>
      </Tooltip>
    </span>
  );
}
