import { useEffect, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight } from "@phosphor-icons/react";
import { ThemeToggle } from "./ThemeToggle";

// /terms and /privacy. Two static pages on one shell. The copy covers the
// anonymous wall as it runs today and the signed in layer planned in
// .cursor/plans/ask_anything_with_accounts: accounts, private asks, model
// answers through the Convex AI Gateway, profiles, and admin moderation
// (hide, pause, block, restore). Update the date and the copy together when
// the data flow changes.

const UPDATED = "September 19, 2026";
const SITE = "https://www.askjev.ai";
const REPO = "https://github.com/waynesutton/ask-jev-ai";
const MAINTAINER = "https://waynesutton.ai";

// A section is a title plus a list of blocks. A string array renders as a
// bulleted list; anything else renders as a paragraph.
type Section = {
  title: string;
  body: Array<ReactNode | string[]>;
};

function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children} <ArrowUpRight size={11} aria-hidden="true" />
    </a>
  );
}

function LegalPage({
  title,
  lede,
  sections,
}: {
  title: string;
  lede: ReactNode;
  sections: Array<Section>;
}) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Ask Jev`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <main className="legal">
      <div className="wrap hero__top label">
        <a className="admin__back" href="/">
          <ArrowLeft size={11} aria-hidden="true" /> Back to the wall
        </a>
        <ThemeToggle />
      </div>

      <article className="wrap legal__body">
        <header className="legal__head">
          <p className="label">Ask Jev</p>
          <h1 className="heading-lg">{title}</h1>
          <p className="label">Last updated {UPDATED}</p>
          <p className="subheading muted">{lede}</p>
        </header>

        {sections.map((section) => (
          <section className="legal__section" key={section.title}>
            <h2 className="heading-sm">{section.title}</h2>
            {section.body.map((block, i) =>
              Array.isArray(block) ? (
                <ul className="body legal__list" key={i}>
                  {block.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="body" key={i}>
                  {block}
                </p>
              ),
            )}
          </section>
        ))}

        <footer className="legal__foot label">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <Out href={REPO}>Source</Out>
        </footer>
      </article>
    </main>
  );
}

// Terms of service

const TERMS: Array<Section> = [
  {
    title: "Agreement to these terms",
    body: [
      <>
        By visiting, posting to, or creating an account on Ask Jev at{" "}
        <Out href={SITE}>askjev.ai</Out> (the "Service") you agree to these
        Terms of Service ("Terms"). If you do not agree, do not use the Service.
      </>,
      <>
        Ask Jev is an open source demo. The code lives at{" "}
        <Out href={REPO}>github.com/waynesutton/ask-jev-ai</Out>. These Terms
        cover the hosted site at askjev.ai only, not the source code. Anyone who
        runs their own copy is responsible for that copy.
      </>,
      <>
        The Service is a work in progress. Some features described here may
        arrive after this date or change shape. These Terms apply to whatever is
        live when you use it.
      </>,
    ],
  },
  {
    title: "What the Service is",
    body: [
      <>
        Ask Jev is a public wall. You type a short ask. Jev, the judgment model
        made by TypeSafe AI, reads it and answers yes, no, or it depends, along
        with a mood, a topic, and whether the ask fits the wall. Convex stores
        the verdict and every open browser sees the wall move at once. The site
        counts toward one million asks and shows what that costs.
      </>,
      <>
        With an account, an ask can also get a short written answer from a
        language model. Jev picks which model in the same call, and the answer
        streams into the card. Signed in users can keep asks private, follow up
        in a thread, keep a history, set up a profile, export their data, and
        delete their account.
      </>,
      <>
        It is a demo built to show what a judgment model and a realtime database
        can do together. It is not a product, a search engine, or a source of
        advice.
      </>,
    ],
  },
  {
    title: "Who runs it",
    body: [
      <>
        The Service is built and run by Wayne Sutton (
        <Out href={MAINTAINER}>waynesutton.ai</Out>), referred to here as the
        "maintainer", as a personal project. The maintainer also holds the one
        admin account, referred to here as the "admin".
      </>,
      <>
        The Service is not made, operated, endorsed, or sponsored by TypeSafe AI
        or by Convex, Inc. TypeSafe provides the Jev API. Convex provides the
        database, hosting, authentication, and the AI Gateway that routes model
        answers. Both are third party vendors. The language models that write
        answers belong to their own providers. None of these companies is a
        party to these Terms, and none has any responsibility for the Service,
        the wall, the asks people post, Jev's answers, or the model answers as
        shown here. Any claim about the Service is a claim against the
        maintainer only, subject to the limits below.
      </>,
    ],
  },
  {
    title: "Accounts",
    body: [
      <>
        You do not need an account to read the wall or post to it. An account is
        needed for model answers, private asks, follow ups, history, profiles,
        and export.
      </>,
      [
        "You must be at least 13 years old to create an account",
        "One account per person. Use a real email address that you control",
        "Keep your password to yourself. Everything done with your account is on you",
        "Do not create an account for someone else, impersonate anyone, or pick a handle that misleads",
        "Do not sign up again after the admin has blocked you, with that email or another",
      ],
      <>
        Your handle, display name, bio, links, and photo are optional. If you
        turn your profile public, that page is visible to anyone on the
        internet. Keep it off and only your public asks show on the wall,
        without a name attached.
      </>,
    ],
  },
  {
    title: "Public and private asks",
    body: [
      <>
        Anonymous asks and public asks from an account appear on the wall the
        moment Jev clears them. Anyone on the internet can read them. Search
        engines may index them. Each public ask has its own page. They may show
        up in screenshots, share images, social posts, talks, and the project
        repository.
      </>,
      <>
        Private asks, available to accounts, do not appear on the wall, in
        search, or on your profile. They are still stored, still judged by Jev,
        still answered by a model, and still visible to the admin for
        moderation. Private means not shown to the public. It does not mean
        encrypted or hidden from the maintainer.
      </>,
      <>
        Do not post anything you would not want on a public page with your name
        next to it, even in a private ask.
      </>,
      [
        "Do not post personal information about yourself or anyone else",
        "Do not post passwords, keys, addresses, phone numbers, or anything private",
        "Do not name or target a real person",
        "Do not post anything illegal, harassing, hateful, or sexual",
      ],
    ],
  },
  {
    title: "Jev's answers and model answers",
    body: [
      <>
        Jev is a machine learning model. Its answers are probabilities, not
        facts. The written answers come from third party language models chosen
        by Jev and routed through the Convex AI Gateway. Both can be wrong, odd,
        offensive, out of date, or confidently mistaken about anything. The
        Service shows them as they arrive, without review.
      </>,
      <>
        Nothing on the Service is advice. Do not rely on Jev or any model answer
        for medical, legal, financial, safety, or any other decision. If you act
        on an answer, that is your choice and your risk.
      </>,
      <>
        Model answers are a budgeted feature. Each account has a limit on how
        many answers it can get per minute and per day, and the maintainer may
        lower those limits, pause answers, or turn the feature off at any time
        to control cost.
      </>,
    ],
  },
  {
    title: "Use at your own risk",
    body: [
      <>
        THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT
        WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
        WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
        ACCURACY, AND NONINFRINGEMENT.
      </>,
      [
        "Your use of the Service is at your sole risk",
        "The maintainer does not promise the Service will be available, timely, secure, or free of errors",
        "The maintainer does not promise that any ask will be judged, answered, shown, kept, or removed",
        "The maintainer does not promise that private asks, history, or profiles will be preserved",
        "You are responsible for any harm to your device or data that comes from using the Service",
      ],
    ],
  },
  {
    title: "Your conduct",
    body: [
      <>You agree not to:</>,
      [
        "Post content that is illegal or that you do not have the right to post",
        "Try to get around the word gates, the rate limits, the answer budgets, or the held topics list",
        "Use scripts, bots, or automation to post, scrape, or flood the wall or the answer feature",
        "Create many accounts, or use an account to hide who is posting",
        "Probe, attack, or attempt unauthorized access to the Service, its functions, other accounts, or its providers",
        "Interfere with other people's use of the Service",
        "Use the Service to store or spread malicious code",
        "Use model answers to generate content that breaks the rules above",
      ],
      <>
        The Service filters asks with a profanity blocklist, an allowlist of
        plain English words on the public wall, a server side held topics list,
        and Jev's own safety scores. None of these are perfect. Some asks that
        should be held will get through and some that are fine will be held.
      </>,
    ],
  },
  {
    title: "Moderation and enforcement",
    body: [
      <>
        The admin may act on any content or any account, at any time, for any
        reason, with or without notice, and in particular when the admin
        believes abuse is happening or about to happen. Abuse includes anything
        in Your conduct above, spamming the wall, running up model costs,
        harassing people, or anything the admin judges harmful to the Service,
        its users, or its providers.
      </>,
      <>The admin can:</>,
      [
        "Hide or unhide any ask on the wall, and hide or show its model answer",
        "Remove any ask, answer, thread, profile, photo, or account",
        "Pause an account, which keeps sign in, history, and export working but stops posting, answers, and follow ups",
        "Block an account, which shuts off access, hides that account's public asks from the wall, and stops that email from signing up again",
        "Restore a paused or blocked account",
        "Change rate limits and answer budgets for everyone or for one account",
        "Reset the wall or shut the Service down",
      ],
      <>
        A reason and a timestamp are recorded with each pause or block. There is
        no appeals process, but you can reach the maintainer (see Contact) and
        the admin may restore access. The admin's decision is final.
      </>,
    ],
  },
  {
    title: "Your words",
    body: [
      <>
        You keep whatever rights you have in the words you post. By posting, you
        give the maintainer a worldwide, royalty free, non exclusive license to
        store, process, display, and reproduce your asks, follow ups, Jev's
        answers, and the model answers to them, on the wall, on your ask pages
        and profile, in the project's documentation and repository, in
        screenshots and share images, and in talks or posts about the project.
        Private asks are covered by the same license but will not be shown
        publicly unless you make them public.
      </>,
      <>
        Model answers are generated text. The maintainer makes no claim to own
        them and gives no promise that they are free of third party rights.
      </>,
    ],
  },
  {
    title: "Deleting your account",
    body: [
      <>
        You can delete your account from your settings. Deletion removes your
        account row, handle, profile, photo, private asks, threads, and follow
        ups. Public asks stay on the wall so the count toward one million stays
        honest, but they are detached from you: the link to your account is
        cleared and no name or handle is shown.
      </>,
      <>
        Two things survive deletion. The authentication component keeps an
        orphaned password hash that is tied to nothing; this is a limit of the
        current auth library and is documented in the source. If your account
        was blocked, your email stays on the blocked list so the account cannot
        be recreated.
      </>,
      <>
        You can export your data as JSON before you delete. The admin account
        cannot be deleted from the interface.
      </>,
    ],
  },
  {
    title: "Limitation of liability",
    body: [
      <>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE MAINTAINER, TOGETHER WITH
        ANY FAMILY MEMBERS, EMPLOYEES, CONTRACTORS, CONTRIBUTORS, AND
        AFFILIATES, AND THE THIRD PARTY PROVIDERS NAMED IN THESE TERMS, SHALL
        NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
        PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR
        OTHER INTANGIBLE LOSSES, RESULTING FROM:
      </>,
      [
        "Your use of or inability to use the Service",
        "Any ask, answer, follow up, profile, or other content on the Service, including content posted by other people",
        "Any answer Jev or a language model gives and anything you do because of it",
        "Any unauthorized access to the Service, your account, or the data it holds",
        "Any interruption, bug, error, or omission in the Service",
        "Any action the admin takes on content, accounts, or access, including pausing or blocking you",
        "Any loss of private asks, history, profile data, or exports",
      ],
      <>
        THE SERVICE IS FREE. IN NO EVENT SHALL THE TOTAL LIABILITY OF THE
        MAINTAINER FOR ALL CLAIMS EXCEED THE AMOUNT YOU PAID TO USE THE SERVICE
        OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS LESS.
      </>,
    ],
  },
  {
    title: "Indemnification",
    body: [
      <>
        You agree to defend, indemnify, and hold harmless the maintainer, and
        any family members, employees, contractors, contributors, and
        affiliates, and the third party providers named in these Terms, from any
        claim, damage, loss, liability, cost, or debt arising from your use of
        the Service, your account, your violation of these Terms, your violation
        of anyone's rights, or any claim that something you posted or a model
        answered for you caused harm.
      </>,
    ],
  },
  {
    title: "Waiver of legal action",
    body: [
      <>By using the Service you agree that:</>,
      [
        "You will not bring any lawsuit, legal claim, or legal action against the maintainer, or any family members, employees, contractors, or contributors, arising from or related to your use of the Service",
        "You waive any right to take part in a class action against the maintainer",
        "Any dispute will be handled through good faith communication first",
      ],
      <>This waiver is a material term of your agreement to use the Service.</>,
    ],
  },
  {
    title: "Changes and shutdown",
    body: [
      <>
        The maintainer may change the Service, add or remove features, pause it,
        reset the wall, or shut it down at any time, with or without notice. The
        maintainer may change these Terms by posting a new version here and
        updating the date. Using the Service after a change means you accept the
        new Terms.
      </>,
    ],
  },
  {
    title: "Third party services",
    body: [
      <>The Service runs on services owned by other companies:</>,
      [
        "Convex for the database, functions, file storage, authentication, hosting, and the AI Gateway that routes model answers",
        "TypeSafe AI for the Jev judgment API",
        "Language model providers reached through the Convex AI Gateway, which may include Google, Anthropic, OpenAI, and Perplexity, depending on which model Jev picks",
        "Cloudflare for DNS in front of the site",
        "Google Fonts and rsms.me for web fonts",
      ],
      <>
        Your use of the Service is also subject to their terms and privacy
        policies, which the maintainer does not control.
      </>,
    ],
  },
  {
    title: "Governing law",
    body: [
      <>
        These Terms are governed by the laws of the State of California, United
        States, without regard to conflict of law rules.
      </>,
    ],
  },
  {
    title: "Severability and entire agreement",
    body: [
      <>
        If any part of these Terms is found unenforceable, that part is limited
        or removed to the minimum extent needed and the rest stays in force.
        These Terms and the Privacy Policy are the whole agreement between you
        and the maintainer about the Service.
      </>,
    ],
  },
  {
    title: "Contact",
    body: [
      <>
        Open an issue at{" "}
        <Out href={REPO}>github.com/waynesutton/ask-jev-ai</Out> or reach the
        maintainer through <Out href={MAINTAINER}>waynesutton.ai</Out>.
      </>,
      <>
        By using Ask Jev you confirm that you have read, understood, and agree
        to these Terms of Service.
      </>,
    ],
  },
];

export function Terms() {
  return (
    <LegalPage
      title="Terms of service"
      lede="A public wall, a judgment model, optional accounts, and one admin. Here is what you agree to when you post."
      sections={TERMS}
    />
  );
}

// Privacy policy

const PRIVACY: Array<Section> = [
  {
    title: "The short version",
    body: [
      <>
        Without an account: no email, no sign in, no tracking cookies, no
        analytics. The Service stores the words you post, a random id your
        browser made, and Jev's scores. Your IP address is read to rate limit
        posting. The words go to TypeSafe to be judged. Everything that goes
        live is public.
      </>,
      <>
        With an account: the Service also stores your email, a password hash,
        your profile, your public and private asks, follow ups, the model
        answers, and usage counts. Your ask goes to TypeSafe and, for a model
        answer, through the Convex AI Gateway to the model Jev picks. Nothing is
        sold, nothing is used for ads, and you can export or delete your data
        yourself.
      </>,
    ],
  },
  {
    title: "What is collected from everyone",
    body: [
      <>
        <b>The ask.</b> The words you post, normalized. Public asks are three to
        fifteen words. This is stored in Convex and shown on the wall if it
        passes.
      </>,
      <>
        <b>An anonymous session id.</b> On your first visit the browser makes a
        random UUID and keeps it in <code>localStorage</code> under the key{" "}
        <code>ftm.session</code>. It is stored with each anonymous ask so the
        page can show you your own recent asks and their status, and so posting
        can be rate limited per browser. It is not tied to your name, email,
        account, or device. It never appears on the public wall and is not
        returned by the public wall queries.
      </>,
      <>
        <b>Your IP address.</b> Each anonymous post reads the caller's IP to
        enforce a limit of five posts per minute per IP. The rate limiter holds
        that count for the one minute window and no longer. The IP is not
        written to the ask. Convex, as the platform, keeps function logs that
        may include request metadata under its own policy.
      </>,
      <>
        <b>Theme.</b> Light or dark, stored in <code>localStorage</code> under{" "}
        <code>ask-jev-theme</code>. Never sent to the server.
      </>,
      <>
        <b>Jev's judgments.</b> For each ask: the reply (yes, no, depends, or
        not a yes or no question) and its confidence, a mood and confidence, a
        topic and confidence, three safety scores (unkind, adult, targets a
        person), which model route Jev picked and how sure it was, how long Jev
        took, and the token counts TypeSafe reports. All of it is stored with
        the ask and most of it is shown on the wall.
      </>,
      <>
        <b>Votes on Jev.</b> If you tap agree or disagree under an ask, one row
        stores the ask id, which way you voted, and your session id or account
        id so the same person counts once. The agree and disagree totals are
        shown on the card and roll into a public agreement rate. Votes never
        change a verdict. Deleting your account deletes your votes; the totals
        stay.
      </>,
      <>
        <b>Nothing else.</b> No phone, cookies beyond the sign in session
        described below, ad pixels, fingerprinting, or cross site tracking.
      </>,
    ],
  },
  {
    title: "What is collected when you have an account",
    body: [
      <>
        <b>Sign in details.</b> Your email address, used as your username, and
        the methods you use to sign in. Email and password accounts have a
        password hash made and held by Convex Auth using Argon2id; the plain
        password is never stored. Google or GitHub sign in shares a verified
        email, provider account id, and basic profile. The app uses your display
        name to start your profile and links matching verified emails to the
        same account. It does not store provider access tokens or copy provider
        photos. A session token is kept in your browser so you stay signed in.
      </>,
      <>
        <b>Profile.</b> A user number assigned in sign up order, a handle, and
        optionally a display name, a short bio, links to GitHub, LinkedIn, or X,
        a photo stored in Convex file storage, and a flag for whether the
        profile is public.
      </>,
      <>
        <b>Your asks.</b> Every ask you post while signed in is linked to your
        account, marked public or private, and may be archived. Follow ups in a
        thread are stored as messages on that thread. A follow up thread you
        open on someone else's ask stores your account id, the ask id, the
        model, and the turns. Only you and the admin can read it. It is deleted
        when you delete your account or when the ask is deleted.
      </>,
      <>
        <b>Model answers.</b> The answer text, which model wrote it, its input
        and output token counts, how long it took, and whether it succeeded.
      </>,
      <>
        <b>Usage counts.</b> One row per account with totals: asks (public and
        private), answers, tokens in and out for answers, spend on answers, Jev
        tokens, and the time of your last ask. Used for the admin's usage view
        and for the per account rate limits.
      </>,
      <>
        <b>Account status.</b> Active, paused, or blocked, with the reason the
        admin recorded and when. Blocked emails are also kept on a separate
        list.
      </>,
      <>
        <b>Rate limits.</b> Signed in posting is limited per account instead of
        per IP and per browser. The limiter holds counts for its window and no
        longer.
      </>,
    ],
  },
  {
    title: "How it is used",
    body: [
      [
        "To run the wall and show each ask with Jev's answers and, for accounts, the model answer",
        "To show you your own asks, history, and threads, and let you archive, export, or delete them",
        "To sign you in and keep you signed in",
        "To show your public profile and your public asks on it, if you turn the profile on",
        "To pick a model for each ask and stream its answer back to you",
        "To limit posting and answers per IP, per browser, or per account",
        "To count toward one million and compute the running cost from token counts",
        "To let the admin review asks and usage, and to hide, pause, block, or restore when abuse is suspected",
        "To fix bugs and keep the Service running",
      ],
    ],
  },
  {
    title: "What is not done",
    body: [
      [
        "No selling, renting, or trading of any data",
        "No advertising and no ad networks",
        "No sharing with data brokers",
        "No training of models on your asks or answers by the maintainer",
        "No reading of your private asks by anyone but you and the admin",
        "No marketing email. The Service sends no email at all today",
      ],
      <>
        How TypeSafe and the language model providers handle the text they
        receive is governed by their own terms and privacy policies, not by this
        one.
      </>,
    ],
  },
  {
    title: "Where the data goes",
    body: [
      <>
        <b>Google and GitHub</b> handle sign in when you choose their buttons.
        The provider receives the sign in request and returns basic identity
        information to Convex Auth. We request no access to your mail or repositories.
      </>,
      <>
        <b>Convex</b> (<Out href="https://convex.dev">convex.dev</Out>) stores
        every ask, session id, judgment, account, profile, photo, thread, and
        usage row, runs the functions, handles sign in, serves the site, and
        routes model answers through its AI Gateway. Convex sees request
        metadata including IP as part of hosting.
      </>,
      <>
        <b>TypeSafe AI</b> (<Out href="https://typesafe.ai">typesafe.ai</Out>)
        receives the text of the ask, and only the text, so Jev can judge it. No
        session id, account id, email, or IP is sent with it.
      </>,
      <>
        <b>Language model providers</b> receive, through the Convex AI Gateway,
        the text of your ask, Jev's verdict, and any follow ups in the same
        thread, so a model can write an answer. Which provider depends on the
        route Jev picks and may include Google, Anthropic, OpenAI, and
        Perplexity. No account id, email, handle, or IP is sent. Their handling
        of that text is under their own policies.
      </>,
      <>
        <b>Cloudflare</b> handles DNS and redirects for askjev.ai and sees the
        requests that pass through it.
      </>,
      <>
        <b>Google Fonts</b> and <b>rsms.me</b> serve the web fonts. Your browser
        requests them directly, so those services see your IP under their own
        policies.
      </>,
      <>
        Beyond these, data is shared only when required by law, to protect the
        maintainer's rights or someone's safety, or with your consent.
      </>,
    ],
  },
  {
    title: "Public, private, and what the admin sees",
    body: [
      <>
        Every live public ask is visible to anyone, in realtime, without signing
        in, on the wall and on its own page. If your profile is public, your
        handle and photo appear next to your public asks and your profile page
        lists them. Search engines may index all of it. It may appear in
        screenshots, share images, social posts, talks, and the project
        repository. Treat every public ask as public the moment you send it.
      </>,
      <>
        Private asks do not appear on the wall, in search, on your profile, or
        on a public page. Their threads are visible only to you. Follow up
        threads you open on other people's asks are visible only to you as well.
        The asker cannot see them.
      </>,
      <>
        The admin can see everything: every ask in every status, public or
        private, hidden or held, along with the email, handle, status, usage
        counts, and last ask time of every account. This is what moderation
        needs. The admin uses it to hide asks and answers, and to pause, block,
        or restore accounts when abuse is suspected. Asks held back by the word
        gates, the held topics list, or Jev's safety scores are also stored and
        visible to the admin.
      </>,
    ],
  },
  {
    title: "How long it is kept",
    body: [
      [
        "Anonymous asks and judgments are kept for the life of the run to one million, including held asks",
        "Account data, asks, threads, answers, and usage counts are kept until you delete your account or the admin removes them",
        "The maintainer may reset or delete the wall at any time",
        "Rate limit counts expire at the end of their window",
        "The session id and theme stay in your browser until you clear site data; the sign in token stays until you sign out or it expires",
        "Blocked emails are kept after the account is deleted so the account cannot be recreated",
        "Convex may hold backups for a period under its own policy",
      ],
    ],
  },
  {
    title: "Your choices and rights",
    body: [
      <>
        You can read the wall without posting anything and post without an
        account. Clearing site data for askjev.ai in your browser gives you a
        fresh session id and drops the link between that browser and its earlier
        anonymous asks.
      </>,
      <>
        With an account you can edit or clear your profile, turn your public
        profile off, make an ask private or public, archive or delete individual
        asks, export everything as JSON, change your password, and delete your
        account. Deleting removes your account, profile, photo, private asks,
        threads, and follow ups. Public asks stay on the wall detached from you,
        with no handle shown, so the count stays honest. An orphaned password
        hash remains in the auth component and, if you were blocked, your email
        stays on the blocked list.
      </>,
      <>
        To have an anonymous ask removed, or if you cannot sign in, open an
        issue at <Out href={REPO}>github.com/waynesutton/ask-jev-ai</Out> or
        reach the maintainer through <Out href={MAINTAINER}>waynesutton.ai</Out>{" "}
        with the exact words and roughly when it was posted. Because anonymous
        asks carry no identity, those requests are handled case by case.
      </>,
    ],
  },
  {
    title: "Security",
    body: [
      [
        "All traffic runs over HTTPS",
        "Passwords are hashed with Argon2id by Convex Auth and never stored in plain text",
        "Every check the browser makes is repeated on the server, so a modified client cannot skip it",
        "Ownership is checked on the server for every private ask, thread, profile edit, and export",
        "Admin functions require a signed in session that matches the admin account",
        "Hidden asks and hidden answers are masked on the server so the text never reaches another browser",
        "No API keys or secrets are in the repository or the client bundle",
      ],
      <>No system is perfectly secure. You use the Service at your own risk.</>,
    ],
  },
  {
    title: "Children",
    body: [
      <>
        Ask Jev is not for children under 13, does not allow them to create
        accounts, and does not knowingly collect anything from them. If you
        believe a child has an account, contact the maintainer and it will be
        removed.
      </>,
    ],
  },
  {
    title: "International visitors",
    body: [
      <>
        The Service is run from the United States and data is processed there.
        If you visit from elsewhere, your asks, account, and the metadata above
        travel to and are handled in the United States.
      </>,
    ],
  },
  {
    title: "California and EEA rights",
    body: [
      <>
        If you live in California, the CCPA gives you the right to know what is
        collected, to ask for deletion, to opt out of sale (nothing is sold),
        and to not be discriminated against for asking. If you are in the
        European Economic Area, GDPR gives you rights of access, correction,
        erasure, portability, and objection.
      </>,
      <>
        With an account, access and portability are met by the export, and
        erasure by deleting your account. For anonymous asks the Service holds
        no identifier that ties an ask to a person, so those rights are met by
        the removal process above. Contact the maintainer to exercise any of
        them.
      </>,
    ],
  },
  {
    title: "Changes to this policy",
    body: [
      <>
        Changes are posted here with a new date at the top. Features described
        here may ship after this date; when they do, this policy already covers
        them. Using the Service after a change means you accept the updated
        policy.
      </>,
    ],
  },
  {
    title: "Open source",
    body: [
      <>
        The code is the policy. Read <code>convex/messages.ts</code> for what is
        stored, <code>convex/questions.ts</code> for what is sent to Jev, and{" "}
        <code>convex/admin.ts</code> for what the admin can do, at{" "}
        <Out href={REPO}>github.com/waynesutton/ask-jev-ai</Out>.
      </>,
      <>
        By using Ask Jev you confirm that you have read and understood this
        Privacy Policy.
      </>,
    ],
  },
];

export function Privacy() {
  return (
    <LegalPage
      title="Privacy policy"
      lede="What Ask Jev stores, where it goes, who can see it, and what it never touches."
      sections={PRIVACY}
    />
  );
}
