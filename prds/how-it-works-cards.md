# How it works as three step cards

Created: 2026-09-22 07:45 UTC
Last Updated: 2026-09-22 07:58 UTC
Status: Done

## Problem

The How it works section on the home page is three long centered paragraphs (about 330 words) followed by seven small fact cards. It says everything but reads like a wall of text: the eye has nowhere to land, the links to the Convex docs and the AI Gateway docs are buried mid sentence, and the section looks nothing like the rest of the page, which is built from cards, chips, bars, and mono labels.

## Proposed solution

Replace the paragraphs with a two column layout: a short head on the left (label, heading, two sentence subheading, two buttons), and three step cards on the right. Each card opens with a small stage that shows the app's own primitives at that step, then a numbered title, two or three plain sentences, and one outbound link.

- 01 Ask. Jev judges. Stage: a mini wall card with an ask, the verdict chip with its percent, a quiet lean tag, the topic chip, latency, and the two "How sure was Jev" bars.
- 02 Jev picks the lane. Stage: the four lanes from `ROUTES`, one picked, each with its model label. Names come from the constant, so the card tracks the code.
- 03 The answer streams to every tab. Stage: the model line with the pulsing dot, a streamed sentence with a caret, and three small tab cards that pulse in turn.

Under the cards, one ruled row called "Built on" carries every outbound link as a mono chip: Convex AI Gateway, Decisions with Jev, Agent component, Convex Auth, Rate limiter, Sharded counter, Static hosting, TypeSafe. A second ruled row carries the numbers that used to be fact cards: length, rate, models and providers, Jev's price. Every number is imported from the constant the server enforces.

Both skins keep their own tokens. Light: paper cards on limestone, 24px radius, no border, the stage is an inset well. Dark: charcoal cards with hairlines, 8px radius. One token is added to both blocks, `--stage`: a hair under canvas in light (`#d9d9d5`) so the well reads as inset rather than cut through to the page, and canvas in dark where the hairlines already carry the edge.

## Files to change

- `src/components/HowItWorks.tsx` rewrite.
- `src/styles.css` replace the `.facts` and `.fact` rules with `.how*` rules, plus the three breakpoints.
- `files.md`, `changelog.md`, `task.md`.

## Edge cases

- `jev` false or `provider` null: step 01 still links to the gateway Decisions docs; the head status is not repeated here since the hero already carries it.
- `provider === "typesafe"`: step 01 links to the TypeSafe docs instead.
- Reduced motion: the pulsing dot, the caret blink, and the tab pulse all stop. The bars already stop under the existing rule.
- Narrow widths: 1100px puts the head above the cards; 800px stacks the cards in one column; 520px stacks the number row.
- The stage content is illustrative (one example ask and its verdict), not live data. The lane names, model labels, word limits, rates, and price are live constants.

## Verification

- `npm run typecheck` clean.
- In the browser on dev at 1440, 1024, 800, and 375: three cards in a row, then head above cards, then one column; no horizontal overflow.
- Both skins.
- Every link has `target="_blank"` and `rel="noreferrer"` except `/docs`.

## Task completion log

- 2026-09-22 07:45 UTC PRD written, build started.
- 2026-09-22 07:58 UTC Built and verified on dev. `npm run typecheck` clean. Checked in the browser at 1440 (both skins), 1024, and 375: three cards, then head above cards, then one column, no horizontal overflow at any width. Three fixes came out of the pass: the stage bleed went from 40px to 24px so the verdict row and the sureness bars stay readable; the lane rows got a stepped 6/12/18px indent, a 7ch name column, and the `picked` tag moved before the model label so `explain` no longer collides with it; the "Built on" row on mobile lost its 88px flex basis and baseline alignment, which had left a label sized gap above the chips. Light stage well moved from `--canvas` to a new `--stage` token so it reads as inset. Not deployed.
