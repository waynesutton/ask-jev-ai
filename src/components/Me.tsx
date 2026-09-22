import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight } from "@phosphor-icons/react";
import {
  useConvex,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { modelLabel } from "../../convex/questions";
import { useMe, type Me as MeRow } from "../hooks/useMe";
import { useNow } from "../hooks/useNow";
import { userMessage } from "../lib/errors";
import { formatCount, timeAgo } from "../lib/format";
import { navigate } from "../lib/router";
import { AnswerBlock, type PublicMessage } from "./AnswerBlock";
import { Avatar } from "./Avatar";
import { Link } from "./Link";
import { CopyLink } from "./CopyLink";
import { FollowUp } from "./FollowUp";
import { VerdictChip } from "./JevAnswers";
import { AgreedNote } from "./Vote";
import { ThemeToggle } from "./ThemeToggle";
import { Hint, Tooltip } from "./Tooltip";

// /me. Your account in three parts: profile settings with the photo; the
// account row with password, export, and delete; then the history of
// every ask with archive, visibility, and delete. An anchor row under the
// heading jumps to each. A visitor is sent to sign in.
export function Me() {
  const me = useMe();

  useEffect(() => {
    document.title = "Your account · Ask Jev";
  }, []);

  useEffect(() => {
    if (me === null) navigate("/sign-in");
  }, [me]);

  return (
    <main className="admin page">
      <div className="wrap hero__top label">
        <Link className="admin__back" href="/">
          <ArrowLeft size={11} aria-hidden="true" /> Back to the wall
        </Link>
        <ThemeToggle />
      </div>
      <section className="wrap admin__body">
        {!me ? <p className="label">Checking session</p> : <Account me={me} />}
      </section>
    </main>
  );
}

function Account({ me }: { me: MeRow }) {
  const { signOut } = useAuthActions();
  return (
    <>
      <div className="admin__head">
        <div>
          <p className="label">
            {me.profile.userNumber !== null
              ? `User #${me.profile.userNumber}`
              : "Account"}{" "}
            · {me.email}
          </p>
          <h1 className="heading-lg">
            {me.profile.displayName ?? `@${me.profile.handle}`}
          </h1>
        </div>
        <div className="admin__headActions">
          <Link className="ghost" href={`/${me.profile.handle}`}>
            {me.profile.publicProfile ? "Public profile" : "Your profile"}
          </Link>
          {me.admin && (
            <Link className="ghost" href="/admin">
              Admin
            </Link>
          )}
          <button
            className="ghost"
            type="button"
            onClick={() => void signOut().then(() => navigate("/"))}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Anchor row. Plain hash links: the path does not change, so the
          router stays out of it and the browser scrolls to the section. */}
      <nav className="me__nav label" aria-label="On this page">
        {ME_SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {s.title}
          </a>
        ))}
      </nav>

      {me.status === "paused" && (
        <div className="card notice">
          <p className="label">Account paused</p>
          <p className="body-sm">
            An admin paused new asks on this account. Your history is intact and
            you can still export it.
          </p>
        </div>
      )}

      <Settings me={me} />
      <Danger me={me} />
      <History />
      <FollowUps />
    </>
  );
}

// Section ids double as anchor targets. Order here is page order.
const ME_SECTIONS = [
  { id: "me-profile", title: "Profile" },
  { id: "me-account", title: "Account" },
  { id: "me-asks", title: "Your asks" },
  { id: "me-follow-ups", title: "Follow ups" },
] as const;

// Side threads: your follow ups on asks that are not yours. Each row links
// back to the ask, where the thread and its composer live. Follow ups on
// your own asks are part of those asks and sit in Your asks above.
function FollowUps() {
  const threads = useQuery(api.answer.myThreads);
  const now = useNow();
  return (
    <section className="me__section" id="me-follow-ups">
      <div className="me__sectionHead">
        <h2 className="subheading">
          Follow ups{" "}
          <Hint tip="Threads you opened on other people's asks. Private to you. Follow ups on your own asks live with those asks above." />
        </h2>
      </div>
      {threads === undefined ? (
        <p className="label">Loading</p>
      ) : threads.length === 0 ? (
        <div className="card empty">
          <p className="subheading">No follow ups yet.</p>
          <p className="body-sm muted">
            Tap <b>Ask a follow up</b> under any ask on{" "}
            <Link href="/">the wall</Link> and the thread lands here.
          </p>
        </div>
      ) : (
        <ul className="admin__list">
          {threads.map((t) => (
            <li key={t._id} className="admin__row">
              <div className="admin__main">
                <p className="admin__text">
                  <Link href={`/a/${t.messageId}`}>{t.text}</Link>
                </p>
                <div className="admin__meta label">
                  <span>
                    {formatCount(t.count)}{" "}
                    {t.count === 1 ? "follow up" : "follow ups"}
                  </span>
                  <span>{modelLabel(t.model)}</span>
                  <span>{timeAgo(t.lastAt, now)}</span>
                  {!t.open && (
                    <Tooltip tip="The ask was held or hidden after you opened this thread, so it takes no more follow ups.">
                      <span className="tag">closed</span>
                    </Tooltip>
                  )}
                  {t.open && (
                    <Link
                      className="followup__link"
                      href={`/a/${t.messageId}#follow-up`}
                    >
                      Continue
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type HistoryFilter = FunctionArgs<typeof api.profile.history>["filter"];

const HISTORY_FILTERS: Array<{
  id: HistoryFilter;
  label: string;
  tip: string;
}> = [
  { id: "all", label: "All", tip: "Every ask that is not archived" },
  { id: "private", label: "Private", tip: "Asks only you can see" },
  { id: "public", label: "On the wall", tip: "Asks anyone can see" },
  { id: "archived", label: "Archived", tip: "Tucked away, still yours" },
];

function History() {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const { results, status, loadMore } = usePaginatedQuery(
    api.profile.history,
    { filter },
    { initialNumItems: 20 },
  );

  return (
    <section className="me__section" id="me-asks">
      <div className="me__sectionHead">
        <h2 className="subheading">
          Your asks{" "}
          <Hint tip="Everything you asked while signed in. Private asks never left this list." />
        </h2>
        <div className="seg" role="group" aria-label="Filter your asks">
          {HISTORY_FILTERS.map((f) => (
            <Tooltip key={f.id} tip={f.tip}>
              <button
                type="button"
                className={
                  "seg__btn" + (filter === f.id ? " seg__btn--on" : "")
                }
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      {status === "LoadingFirstPage" ? (
        <p className="label">Loading</p>
      ) : results.length === 0 ? (
        <div className="card empty">
          <p className="subheading">
            {filter === "archived" ? "Nothing archived." : "Nothing here yet."}
          </p>
          {filter !== "archived" && (
            <p className="body-sm muted">
              <Link href="/">Ask something</Link> and it lands here.
            </p>
          )}
        </div>
      ) : (
        <ul className="admin__list">
          {results.map((m) => (
            <HistoryRow key={m._id} m={m} />
          ))}
        </ul>
      )}

      {status === "CanLoadMore" && (
        <div className="wall__more">
          <button className="ghost" type="button" onClick={() => loadMore(20)}>
            Load more
          </button>
        </div>
      )}
      {status === "LoadingMore" && (
        <div className="wall__more label">Loading</div>
      )}
    </section>
  );
}

function HistoryRow({ m }: { m: PublicMessage }) {
  const now = useNow();
  const setVisibility = useMutation(api.profile.setVisibility);
  const setArchived = useMutation(api.profile.setArchived);
  const remove = useMutation(api.profile.remove);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(userMessage(e, "Could not update. Try again"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="admin__row">
      <div className="admin__main">
        <p className="admin__text">
          <Link href={`/a/${m._id}`}>{m.text}</Link>
        </p>
        <div className="admin__meta label">
          <span className={`tag tag--${m.status}`}>
            {m.status === "blocked" ? "held" : m.status}
          </span>
          <span className="tag">{m.visibility}</span>
          {m.archived && <span className="tag">archived</span>}
          {m.hidden && <span className="tag">hidden by admin</span>}
          {m.wallHidden && !m.hidden && (
            <Tooltip tip="A word here is one the wall does not show. You see it in full; the wall blurs it for others.">
              <span className="tag">blurred on wall</span>
            </Tooltip>
          )}
          <VerdictChip reply={m.answers?.reply} answers={m.answers} />
          <AgreedNote agree={m.agree} disagree={m.disagree} />
          {m.answerModel && <span>{m.answerModel}</span>}
          <span>{timeAgo(m._creationTime, now)}</span>
          <CopyLink messageId={m._id} />
          <FollowUp m={m} />
        </div>
        {m.answerText && !m.answerHidden && <AnswerBlock message={m} compact />}
        {error && (
          <p className="label label--ink" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="admin__rowActions">
        {m.status === "live" && (
          <Tooltip
            tip={
              m.visibility === "private"
                ? m.wallHidden
                  ? "Put this ask on the public wall. It will show blurred for others because of a word the wall does not show."
                  : "Put this ask on the public wall, answer included."
                : "Take this ask off the wall. Only you will see it."
            }
          >
            <button
              className="ghost ghost--small"
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  setVisibility({
                    messageId: m._id,
                    visibility:
                      m.visibility === "private" ? "public" : "private",
                  }),
                )
              }
            >
              {m.visibility === "private" ? "Show on wall" : "Make private"}
            </button>
          </Tooltip>
        )}
        <Tooltip
          tip={
            m.archived
              ? "Bring this ask back to your list"
              : "Tuck this ask away. It stays yours and stays on the wall if public."
          }
        >
          <button
            className="ghost ghost--small"
            type="button"
            disabled={busy}
            onClick={() =>
              void run(() =>
                setArchived({ messageId: m._id, archived: !m.archived }),
              )
            }
          >
            {m.archived ? "Unarchive" : "Archive"}
          </button>
        </Tooltip>
        {confirming ? (
          <>
            <button
              className="ghost ghost--small ghost--danger"
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() => remove({ messageId: m._id })).then(() =>
                  setConfirming(false),
                )
              }
            >
              Confirm delete
            </button>
            <button
              className="ghost ghost--small"
              type="button"
              onClick={() => setConfirming(false)}
            >
              Keep
            </button>
          </>
        ) : (
          <Tooltip tip="Delete this ask and its thread for good">
            <button
              className="ghost ghost--small ghost--danger"
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
          </Tooltip>
        )}
      </div>
    </li>
  );
}

// Profile fields. Each save sends only the fields that changed; empty
// clears. Handle changes move your askjev.ai/handle URL.
function Settings({ me }: { me: MeRow }) {
  const update = useMutation(api.profile.update);
  const p = me.profile;
  const [handle, setHandle] = useState(p.handle);
  const [displayName, setDisplayName] = useState(p.displayName ?? "");
  const [bio, setBio] = useState(p.bio ?? "");
  const [github, setGithub] = useState(p.github ?? "");
  const [linkedin, setLinkedin] = useState(p.linkedin ?? "");
  const [x, setX] = useState(p.x ?? "");
  const [publicProfile, setPublicProfile] = useState(p.publicProfile);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await update({
        handle: handle !== p.handle ? handle : undefined,
        displayName:
          displayName !== (p.displayName ?? "") ? displayName : undefined,
        bio: bio !== (p.bio ?? "") ? bio : undefined,
        github: github !== (p.github ?? "") ? github : undefined,
        linkedin: linkedin !== (p.linkedin ?? "") ? linkedin : undefined,
        x: x !== (p.x ?? "") ? x : undefined,
        publicProfile:
          publicProfile !== p.publicProfile ? publicProfile : undefined,
      });
      setSaved(true);
    } catch (e) {
      setError(userMessage(e, "Could not save your profile. Try again"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="me__section" id="me-profile">
      <div className="me__sectionHead">
        <h2 className="subheading">
          Profile{" "}
          <Hint tip="Shown on askjev.ai/your_handle when the profile is public. Private profiles show nothing but the handle on your public asks." />
        </h2>
      </div>
      <div className="me__grid">
        <Photo photoUrl={p.photoUrl} handle={p.handle} />
        <form className="card auth me__form" onSubmit={onSubmit}>
          <label className="label" htmlFor="me-handle">
            Handle{" "}
            <Hint tip="Letters, numbers, underscores. Your profile lives at askjev.ai/your_handle." />
          </label>
          <input
            id="me-handle"
            className="composer__input auth__input"
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase())}
            autoCapitalize="none"
            spellCheck={false}
            maxLength={24}
            disabled={busy}
          />
          <label className="label" htmlFor="me-name">
            Display name
          </label>
          <input
            id="me-name"
            className="composer__input auth__input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            disabled={busy}
          />
          <label className="label" htmlFor="me-bio">
            Bio
          </label>
          <textarea
            id="me-bio"
            className="composer__input auth__input composer__textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            maxLength={160}
            disabled={busy}
          />
          <div className="me__links">
            <div>
              <label className="label" htmlFor="me-github">
                GitHub
              </label>
              <input
                id="me-github"
                className="composer__input auth__input"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="username"
                autoCapitalize="none"
                spellCheck={false}
                disabled={busy}
              />
            </div>
            <div>
              <label className="label" htmlFor="me-linkedin">
                LinkedIn
              </label>
              <input
                id="me-linkedin"
                className="composer__input auth__input"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="in/username"
                autoCapitalize="none"
                spellCheck={false}
                disabled={busy}
              />
            </div>
            <div>
              <label className="label" htmlFor="me-x">
                X
              </label>
              <input
                id="me-x"
                className="composer__input auth__input"
                value={x}
                onChange={(e) => setX(e.target.value)}
                placeholder="username"
                autoCapitalize="none"
                spellCheck={false}
                disabled={busy}
              />
            </div>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={publicProfile}
              onChange={(e) => setPublicProfile(e.target.checked)}
              disabled={busy}
            />
            <span className="body-sm">
              Public profile{" "}
              <Hint tip="Anyone can open askjev.ai/your_handle and see your usage, streaks, models, join date, user number, links, and public asks. Private asks stay private either way; only their count is yours to see." />
            </span>
          </label>
          {error && (
            <p className="label label--ink" role="alert">
              {error}
            </p>
          )}
          <div className="auth__actions">
            <button className="pill pill--accent" type="submit" disabled={busy}>
              {busy ? "Saving" : "Save profile"}
            </button>
            {saved && <span className="label">Saved</span>}
          </div>
        </form>
      </div>
    </section>
  );
}

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

// Upload flow: ask for a URL, POST the file, hand the storage id back.
function Photo({
  photoUrl,
  handle,
}: {
  photoUrl: string | null;
  handle: string;
}) {
  const generateUploadUrl = useMutation(api.profile.generateUploadUrl);
  const setPhoto = useMutation(api.profile.setPhoto);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Pick an image");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Keep it under 2 MB");
      return;
    }
    setBusy(true);
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await setPhoto({ storageId });
    } catch (e) {
      setError(userMessage(e, "Upload failed. Try a smaller image"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="card me__photo">
      <Avatar photoUrl={photoUrl} handle={handle} size={96} />
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
        }}
      />
      <div className="auth__actions">
        <Tooltip tip="PNG, JPEG, WebP, or GIF up to 2 MB">
          <button
            className="ghost ghost--small"
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Uploading" : photoUrl ? "Change photo" : "Add photo"}
          </button>
        </Tooltip>
        {photoUrl && (
          <button
            className="ghost ghost--small"
            type="button"
            disabled={busy}
            onClick={() => void setPhoto({ storageId: null })}
          >
            Remove
          </button>
        )}
      </div>
      {error && (
        <p className="label label--ink" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Password, export, delete. Export pulls a JSON file with everything the
// server has on you. Delete asks for the phrase, then signs out.
function Danger({ me }: { me: MeRow }) {
  const providers = me.providers ?? ["password"];
  const convex = useConvex();
  const changePassword = useMutation(api.auth.changePassword);
  const deleteAccount = useMutation(api.profile.deleteAccount);
  const { signOut } = useAuthActions();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  const onPassword = async (event: FormEvent) => {
    event.preventDefault();
    setPwBusy(true);
    setPwMsg(null);
    try {
      const result = await changePassword({
        currentPassword: current,
        newPassword: next,
      });
      if ("userError" in result) {
        setPwMsg(passwordMessage(result.userError));
      } else {
        setPwMsg("Password changed");
        setCurrent("");
        setNext("");
      }
    } finally {
      setPwBusy(false);
    }
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const data = await convex.query(api.profile.exportData, {});
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ask-jev-${me.profile.handle}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    setDelError(null);
    try {
      await deleteAccount({ confirm: "delete my account" });
      await signOut();
      navigate("/");
    } catch (e) {
      setDelError(userMessage(e, "Could not delete the account. Try again"));
      setDeleting(false);
    }
  };

  return (
    <section className="me__section" id="me-account">
      <div className="me__sectionHead">
        <h2 className="subheading">Account</h2>
      </div>
      <div className="me__grid me__grid--two">
        {providers.includes("password") ? <form className="card auth" onSubmit={onPassword}>
          <p className="label">Password</p>
          <label className="label" htmlFor="me-pw-current">
            Current
          </label>
          <input
            id="me-pw-current"
            className="composer__input auth__input"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
            disabled={pwBusy}
          />
          <label className="label" htmlFor="me-pw-next">
            New
          </label>
          <input
            id="me-pw-next"
            className="composer__input auth__input"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            disabled={pwBusy}
          />
          {pwMsg && (
            <p className="label label--ink" role="status">
              {pwMsg}
            </p>
          )}
          <div className="auth__actions">
            <button
              className="pill pill--accent"
              type="submit"
              disabled={pwBusy}
            >
              {pwBusy ? "Working" : "Change password"}
            </button>
          </div>
        </form> : (
          <div className="card auth">
            <p className="label">Sign in</p>
            <p className="body-sm">You sign in with {providers.map((p) => p === "google" ? "Google" : "GitHub").join(" and ")}. Manage your password with that provider.</p>
          </div>
        )}

        <div className="card auth">
          <p className="label">Your data</p>
          <p className="body-sm">
            Export everything as JSON: your profile and your newest{" "}
            {formatCount(1000)} asks with Jev's verdicts and model answers.
          </p>
          <div className="auth__actions">
            <Tooltip tip="Downloads a JSON file. Nothing leaves your browser except the request.">
              <button
                className="ghost"
                type="button"
                disabled={exporting}
                onClick={() => void onExport()}
              >
                {exporting ? "Preparing" : "Export JSON"}{" "}
                <ArrowUpRight size={11} aria-hidden="true" />
              </button>
            </Tooltip>
          </div>

          <p className="label me__dangerLabel">Delete account</p>
          {me.admin ? (
            <p className="body-sm muted">
              The admin account cannot delete itself here.
            </p>
          ) : (
            <>
              <p className="body-sm">
                Private asks and threads go for good. Public asks stay on the
                wall with no name on them. Type <b>delete my account</b> to
                confirm.
              </p>
              <input
                className="composer__input auth__input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-label="Type delete my account to confirm"
                autoCapitalize="none"
                disabled={deleting}
              />
              {delError && (
                <p className="label label--ink" role="alert">
                  {delError}
                </p>
              )}
              <div className="auth__actions">
                <button
                  className="ghost ghost--danger"
                  type="button"
                  disabled={deleting || confirm.trim() !== "delete my account"}
                  onClick={() => void onDelete()}
                >
                  {deleting ? "Deleting" : "Delete my account"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

type ChangePasswordError = Extract<
  FunctionReturnType<typeof api.auth.changePassword>,
  { userError: unknown }
>["userError"];

function passwordMessage(userError: ChangePasswordError): string {
  switch (userError.error) {
    case "NOT_SIGNED_IN":
      return "Sign in again to change your password";
    case "INVALID_CREDENTIALS":
      return "Current password is wrong";
    case "PASSWORD_TOO_SHORT":
      return `New password must be at least ${userError.minimumLength} characters`;
    case "PASSWORD_TOO_LONG":
      return `New password must be at most ${userError.maximumLength} characters`;
    case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
      return "Password cannot start or end with a space";
    case "PASSWORD_TOO_COMMON":
      return "That password is too common";
    case "RATE_LIMITED":
      return `Too many tries. Wait ${Math.ceil(userError.retryAfterMs / 1000)}s`;
  }
}
