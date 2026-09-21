import { ArrowUpRight } from "@phosphor-icons/react";
import { MAX_OPEN_WORDS, MAX_WORDS, MIN_WORDS } from "../../convex/lib/words";
import {
  ANON_POSTS_PER_MINUTE,
  USER_POSTS_PER_MINUTE,
} from "../../convex/lib/limits";
import { ROUTES } from "../../convex/questions";
import { Link } from "./Link";

type Props = {
  signedIn: boolean;
  status: string;
};

const GATEWAY = "https://docs.convex.dev/ai-gateway/overview";

// The left column of the hero. Two lanes for a visitor: ask without an
// account and get a verdict, or sign in and get an answer. Each lane is a
// short mono head and a few plain lines, split by the same dotted rule the
// count panel uses. Signed in, one lane: what you can do now. Every number
// comes from the constant the server enforces.
export function Lanes({ signedIn, status }: Props) {
  const routeCount = Object.keys(ROUTES).length;

  if (signedIn) {
    return (
      <div className="lanes">
        <p className="label">Signed in</p>
        <ul className="lanes__list">
          <li>
            <b>Ask anything.</b> Up to {MAX_OPEN_WORDS} words, no word list.
          </li>
          <li>
            <b>Jev judges, then picks the model.</b> One of {routeCount} lanes,
            and the answer streams through the{" "}
            <a href={GATEWAY} target="_blank" rel="noreferrer">
              Convex AI Gateway <ArrowUpRight size={11} aria-hidden="true" />
            </a>{" "}
            with the model's name and the one line why.
          </li>
          <li>
            <b>Wall or private.</b> A held word blurs on the wall for others.
            You keep the ask and the answer either way.
          </li>
          <li>
            <b>{USER_POSTS_PER_MINUTE} asks a minute.</b> History, threads, and
            your profile at <Link href="/me">/me</Link>.
          </li>
        </ul>
        <p className="label">{status}</p>
      </div>
    );
  }

  return (
    <div className="lanes">
      <div className="lanes__lane">
        <p className="label">Without an account</p>
        <ul className="lanes__list">
          <li>
            <b>Yes, no, or it depends.</b> Jev settles the question in about 100
            milliseconds. No reply text.
          </li>
          <li>
            {MIN_WORDS} to {MAX_WORDS} plain words, {ANON_POSTS_PER_MINUTE} asks
            a minute, every ask on the wall.
          </li>
        </ul>
      </div>
      <div className="lanes__lane">
        <p className="label">
          <Link href="/sign-in">Sign in</Link> for the rest
        </p>
        <ul className="lanes__list">
          <li>
            <b>Ask anything, for real.</b> Up to {MAX_OPEN_WORDS} words, no word
            list.
          </li>
          <li>
            Jev picks one of {routeCount} models and a short answer streams
            through the{" "}
            <a href={GATEWAY} target="_blank" rel="noreferrer">
              Convex AI Gateway <ArrowUpRight size={11} aria-hidden="true" />
            </a>
            .
          </li>
          <li>
            Wall or private, a history, a profile, {USER_POSTS_PER_MINUTE} asks
            a minute.
          </li>
        </ul>
      </div>
      <p className="label">{status}</p>
    </div>
  );
}
