import { ArrowUpRight } from "@phosphor-icons/react";
import { MAX_OPEN_WORDS, MAX_WORDS, MIN_WORDS } from "../../convex/lib/words";
import { USER_POSTS_PER_MINUTE } from "../../convex/lib/limits";
import { ROUTES } from "../../convex/questions";
import { Link } from "./Link";

type Props = {
  jev: boolean;
  provider: "typesafe" | "gateway" | null;
};

// Centered intro, then flat fact cards. Says what the app does, nothing more.
export function HowItWorks({ jev, provider }: Props) {
  const routeCount = Object.keys(ROUTES).length;
  // "google/gemini..." → "google". Counted so the copy tracks the table.
  const providerCount = new Set(
    Object.values(ROUTES).map((r) => r.model.split("/")[0]),
  ).size;
  return (
    <section className="section" id="how">
      <div className="wrap">
        <div className="intro">
          <p className="label">A demo of Jev and Convex</p>
          <h2 className="heading-lg">How it works.</h2>
          <p className="subheading muted">
            Visitors type three to fifteen plain words. Jev, TypeSafe's judgment
            model, is not a chatbot and never writes a reply. It reads the
            sentence and answers typed questions about it in about 100
            milliseconds: <b>is it a yes, a no, or it depends</b>, how it feels,
            what it is about, and whether it fits the wall. When Jev reads an
            ask as open, the card says so and points at sign in. Convex stores
            the verdict and every open tab sees the wall move at once.
          </p>
          <p className="subheading muted">
            <b>Signed in, ask anything and Jev picks the model.</b> Up to{" "}
            {MAX_OPEN_WORDS} words, no word list. One more typed question sorts
            your ask into one of {routeCount} lanes: a quick fact, an
            explanation, some reasoning, or something recent. The lane names a
            model and a short answer streams in under the ask with the model's
            name and the one line reason. Keep it private or put it on the wall;
            a word the wall does not show gets blurred there for others while
            you keep the ask and its answer. Your history, threads, and profile
            live at <Link href="/me">/me</Link>. The long version, every rule
            and every number, is in the <Link href="/docs">docs</Link>.
          </p>
          <p className="subheading muted">
            <b>Every model answer runs through the Convex AI Gateway.</b>{" "}
            {routeCount} models from {providerCount} providers sit behind one
            endpoint. Convex holds the provider keys; this app holds none. A
            Convex action asks for a short lived token scoped to this
            deployment, calls the model Jev named, and streams the answer back
            into the database where every open tab picks it up. Add a model by
            changing one line in one file.{" "}
            <a
              href="https://docs.convex.dev/ai-gateway/overview"
              target="_blank"
              rel="noreferrer"
            >
              How the gateway works{" "}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </p>
        </div>

        <div className="facts">
          <Fact
            label="Length"
            value={`${MIN_WORDS} to ${MAX_WORDS} words as a visitor · ${MAX_OPEN_WORDS} signed in`}
          />
          <Fact
            label="Judge"
            value={
              !jev
                ? "Jev, waiting for key"
                : provider === "gateway"
                  ? "Jev via Convex AI Gateway"
                  : "Jev via TypeSafe"
            }
            href="https://docs.typesafe.ai/introduction"
          />
          <Fact
            label="Answers"
            value={`Convex AI Gateway · ${routeCount} models, Jev picks`}
            href="https://docs.convex.dev/ai-gateway/overview"
          />
          <Fact
            label="Accounts"
            value={`Convex Auth · ${USER_POSTS_PER_MINUTE} asks a minute`}
            href="https://auth-v2.previews.convex.dev/getting-started"
          />
          <Fact
            label="Database"
            value="Convex, realtime"
            href="https://convex.dev"
          />
          <Fact
            label="Hosting"
            value="Convex static hosting"
            href="https://www.convex.dev/components/static-hosting"
          />
          <Fact
            label="Jev price"
            value="$0.042 per million tokens in, out free"
          />
        </div>
      </div>
    </section>
  );
}

type FactProps = {
  label: string;
  value: string;
  href?: string;
};

// With an href the whole card is the link and the value carries an arrow.
function Fact({ label, value, href }: FactProps) {
  if (href) {
    return (
      <a
        className="card fact fact--link"
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        <span className="label">{label}</span>
        <span className="body">
          {value} <ArrowUpRight size={14} aria-hidden="true" />
        </span>
      </a>
    );
  }
  return (
    <div className="card fact">
      <span className="label">{label}</span>
      <span className="body">{value}</span>
    </div>
  );
}
