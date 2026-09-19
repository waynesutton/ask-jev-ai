import { ArrowUpRight } from "@phosphor-icons/react";
import { MAX_WORDS, MIN_WORDS } from "../../convex/lib/words";

type Props = {
  jev: boolean;
};

// Centered intro, then five flat fact cards. Says what the app does, nothing more.
export function HowItWorks({ jev }: Props) {
  return (
    <section className="section" id="how">
      <div className="wrap">
        <div className="intro">
          <p className="label">A demo of Jev and Convex</p>
          <h2 className="heading-lg">How it works.</h2>
          <p className="subheading muted">
            Type three to fifteen words. Jev, TypeSafe's judgment model, is not
            a chatbot and never writes a reply. It reads the sentence and
            answers six typed questions about it in about 100 milliseconds:{" "}
            <b>is it a yes, a no, or it depends</b>, how it feels, what it is
            about, and whether it fits the wall. Convex stores the verdict and
            every open tab sees the wall move at once.
          </p>
        </div>

        <div className="facts">
          <Fact label="Length" value={`${MIN_WORDS} to ${MAX_WORDS} words`} />
          <Fact
            label="Judge"
            value={jev ? "Jev, six questions" : "Jev, waiting for key"}
            href="https://docs.typesafe.ai/introduction"
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
          <Fact label="Price" value="$0.042 per million tokens in, out free" />
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
