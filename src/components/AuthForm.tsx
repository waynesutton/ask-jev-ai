import { useState, type FormEvent, type ReactNode } from "react";
import {
  useSignInWithPassword,
  useSignUpWithPassword,
  type SignInWithPasswordResult,
  type SignUpWithPasswordResult,
} from "@convex-dev/auth/providers/password/react";
import { api } from "../../convex/_generated/api";
import {
  useSignInWithGoogle,
  useSignInWithGithub,
} from "@convex-dev/auth/providers/oauth/react";
import { GoogleLogo, GithubLogo } from "@phosphor-icons/react";
import { safeNextPath } from "../lib/oauth";
import { Link } from "./Link";

type Mode = "in" | "up";

type Props = {
  mode: Mode;
  // Mono line above the heading. "Admin" on /admin, "Account" elsewhere.
  eyebrow: string;
  heading: string;
  // Copy under the fields, before the actions.
  note?: ReactNode;
  // Where the other verb lives. Rendered as a ghost link.
  other?: { href: string; label: string };
  onDone?: () => void;
  providers?: boolean;
  next?: string;
};

// One form, two verbs, shared by /sign-in, /sign-up, and /admin. Username
// is an email. Errors come back typed from the auth component and are
// turned into one plain sentence.
export function AuthForm({
  mode,
  eyebrow,
  heading,
  note,
  other,
  onDone,
  providers = true,
  next = "/",
}: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { signIn, pending: signingIn } = useSignInWithPassword(
    api.auth.signInWithPassword,
  );
  const { signUp, pending: signingUp } = useSignUpWithPassword(
    api.auth.signUpWithPassword,
  );
  const { signInGoogle } = useSignInWithGoogle(api.auth);
  const { signInGithub } = useSignInWithGithub(api.auth);
  const [oauthPending, setOauthPending] = useState<"google" | "github" | null>(
    null,
  );
  const pending = signingIn || signingUp || oauthPending !== null;

  const startOauth = async (provider: "google" | "github") => {
    if (pending) return;
    setError(null);
    setOauthPending(provider);
    try {
      const redirectTo = new URL(
        safeNextPath(next, window.location.origin),
        window.location.origin,
      ).href;
      await (provider === "google" ? signInGoogle : signInGithub)({
        redirectTo,
      });
    } catch {
      setError("Could not start sign in. Try again");
      setOauthPending(null);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setError(null);
    try {
      const credentials = { username: username.trim(), password };
      if (mode === "in") {
        const result = await signIn(credentials);
        if (result.status === "error") {
          setError(signInMessage(result.userError));
          return;
        }
      } else {
        const result = await signUp(credentials);
        if (result.status === "error") {
          setError(signUpMessage(result.userError));
          return;
        }
      }
      onDone?.();
    } catch {
      setError("Could not sign in. Try again");
    }
  };

  const id = mode === "in" ? "signin" : "signup";

  return (
    <form className="auth card" onSubmit={onSubmit}>
      <p className="label">{eyebrow}</p>
      <h1 className="heading-lg">{heading}</h1>
      {providers && (
        <>
          <div className="auth__providers">
            <button
              className="ghost auth__provider"
              type="button"
              disabled={pending}
              onClick={() => void startOauth("google")}
            >
              <GoogleLogo size={20} aria-hidden="true" />
              {oauthPending === "google"
                ? "Connecting to Google"
                : "Continue with Google"}
            </button>
            <button
              className="ghost auth__provider"
              type="button"
              disabled={pending}
              onClick={() => void startOauth("github")}
            >
              <GithubLogo size={20} aria-hidden="true" />
              {oauthPending === "github"
                ? "Connecting to GitHub"
                : "Continue with GitHub"}
            </button>
          </div>
          <p className="auth__divider label">or use email</p>
        </>
      )}
      <label className="label" htmlFor={`${id}-username`}>
        Email
      </label>
      <input
        id={`${id}-username`}
        className="composer__input auth__input"
        type="email"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        disabled={pending}
      />
      <label className="label" htmlFor={`${id}-password`}>
        Password
      </label>
      <input
        id={`${id}-password`}
        className="composer__input auth__input"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={mode === "in" ? "current-password" : "new-password"}
        minLength={mode === "up" ? 8 : undefined}
        required
        disabled={pending}
      />
      {error && (
        <p className="label label--ink" role="alert">
          {error}
        </p>
      )}
      {note}
      <div className="auth__actions">
        <button className="pill pill--accent" type="submit" disabled={pending}>
          {pending ? "Working" : mode === "in" ? "Sign in" : "Create account"}
        </button>
        {other && (
          <Link className="ghost" href={other.href}>
            {other.label}
          </Link>
        )}
      </div>
    </form>
  );
}

type SignInError = Extract<
  SignInWithPasswordResult,
  { status: "error" }
>["userError"];

type SignUpError = Extract<
  SignUpWithPasswordResult,
  { status: "error" }
>["userError"];

export function signInMessage(userError: SignInError): string {
  switch (userError.error) {
    case "USER_NOT_FOUND":
      return "No account with that email";
    case "INVALID_CREDENTIALS":
      return "Wrong email or password";
    case "PASSWORD_TOO_SHORT":
      return `Password must be at least ${userError.minimumLength} characters`;
    case "PASSWORD_TOO_LONG":
      return `Password must be at most ${userError.maximumLength} characters`;
    case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
      return "Password cannot start or end with a space";
    case "RATE_LIMITED":
      return `Too many tries. Wait ${Math.ceil(userError.retryAfterMs / 1000)}s`;
    case "OTHER_ERROR":
      console.error("Sign in failed", userError.cause);
      return "Something went wrong";
  }
}

export function signUpMessage(userError: SignUpError): string {
  switch (userError.error) {
    case "USERNAME_TAKEN":
      return "That account already exists. Sign in instead";
    case "USERNAME_TOO_SHORT":
      return "Email is required";
    case "USERNAME_HAS_SURROUNDING_WHITESPACE":
    case "USERNAME_HAS_INVALID_CHARACTERS":
      return "That email has characters that are not allowed";
    case "PASSWORD_TOO_SHORT":
      return `Password must be at least ${userError.minimumLength} characters`;
    case "PASSWORD_TOO_LONG":
      return `Password must be at most ${userError.maximumLength} characters`;
    case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
      return "Password cannot start or end with a space";
    case "PASSWORD_TOO_COMMON":
      return "That password is too common";
    case "OTHER_ERROR":
      // createUser threw: the admin email outside its window, or a
      // blocked email.
      return "This email cannot sign up right now";
  }
}
