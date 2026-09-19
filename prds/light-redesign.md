# Daylight redesign: light default, input in the middle

Created: 2026-09-17 05:55 UTC
Last Updated: 2026-09-17 06:08 UTC
Status: Done

## Problem

The app is warm dark editorial with the counter as the hero and the input pushed below it. The user wants a light, creative, fun UI in the style of the daylight gallery reference: off white canvas, white cards, hairline borders, no shadows, one typeface at one weight, four jewel accents used as left edge bars and filled pills, a frosted blurred hero background, and the input box in the middle. Light is the new default. Dark stays as a toggle so nothing is lost.

## Proposed solution

Tokens from the reference, renamed for this project. Ink #0a0b0c, canvas #f9f9f9, paper #ffffff, ash #d8d8d8, forest #00543d, periwinkle #abcbf9, pink #ffbbfc, butter #fce88b. Inter at 400 everywhere, hierarchy by size only, mixed case. Radii: nav 32, cards 8, inputs 4, buttons pill. Hairlines are ink at low opacity. No shadows, no gradients except the hero wash.

Theme is a `data-theme` attribute on `html`. Light is default. A Phosphor sun and moon toggle in the nav flips it and stores the choice. An inline script in `index.html` applies the stored theme before paint. Dark swaps canvas, paper, ink, and dims the hero wash. Accents stay.

Layout, top to bottom:

1. Dark top bar. "Powered by Convex and TypeSafe" left, small pill "How it works" right.
2. Sticky floating pill nav, white, 32px radius, hairline. Wordmark, links, theme toggle, dark pill "Ask" that focuses the input.
3. Hero, near full viewport, frosted wash of the four accents blurred behind. Centered: headline "Ask Jev anything." at display size, one line of subtext, then the composer in a white card in the middle of the screen. Chips, note, and Yours sit under it inside the same card. A small live line under the card: asks so far, Jev online.
4. Stats section. The big odometer counter with progress bar, then the four cost stat cards with the four accent bars: forest, pink, periwinkle, butter.
5. The wall. Centered intro, grid of white cards. Each card carries a 4px left bar colored by mood (low ash, flat periwinkle, calm forest, happy butter, joyful pink) with the mood word beside it so color is never the only signal. The Jev reply chip is a filled periwinkle pill.
6. How it works. Centered intro, facts as a row of flat white cards.
7. Footer. Hairline top, credits as underlined ink links.

Phosphor icons: ArrowRight on pills, Sun and Moon for the toggle, CaretDown on the answers toggle, ArrowUpRight on external links.

## Files to change

- `package.json` add `@phosphor-icons/react`
- `index.html` theme color, pre paint theme script, color-scheme
- `src/styles.css` full rewrite on the new tokens, both themes
- `src/hooks/useTheme.ts` new
- `src/components/Nav.tsx` top bar, pill nav, toggle, CTA
- `src/App.tsx` hero and stats restructure
- `src/components/Composer.tsx` card wrapper, icon button
- `src/components/CostTracker.tsx` stat cards with accent classes
- `src/components/Counter.tsx` class names
- `src/components/Wall.tsx` mood class on cards, centered intro
- `src/components/HowItWorks.tsx` centered intro
- `src/components/Footer.tsx` drop ember
- `src/components/JevAnswers.tsx` caret icon
- docs

## Kept features

Counter with dim leading zeros and progress, cost tracker, composer with live chips, blocked word masking, blink caret on load, autofocus, rate limit note, Yours with retry, wall pagination and load more, mood of the wall, Jev says chip and answers toggle, how it works facts, footer credits, nav links. Dark mode via toggle.

## Edge cases

- Reduced motion: no blob drift, no card rise.
- Narrow screens: nav links collapse to wordmark, toggle, Ask. Stat cards stack.
- Dark theme contrast: ink on paper flips to #f4f4f4 on #141516, muted text stays at 3:1 or better.
- Accent colors are never used as text.

## Verification

- `npm run typecheck`.
- Light loads by default with the caret blinking in the centered input. Toggle flips to dark and persists across reload.
- Post a message; chips, note, Yours, wall card with mood bar and Jev chip all render.
- 375px viewport: no horizontal scroll.

## Completion log

- 2026-09-17 05:55 UTC PRD written.
- 2026-09-17 06:08 UTC Shipped. One deviation from the plan: Yours under the composer is trimmed to the last three posts with answers collapsed and a Jev chip inline, because eight open answer lists pushed the hero off screen. Verified in the browser at 1280, 720 and 375 in both themes. Typecheck clean.
