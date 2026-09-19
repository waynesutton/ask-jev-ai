# Caldera light mode, no header, no footer

Created: 2026-09-17 06:40 UTC
Last Updated: 2026-09-17 07:00 UTC
Status: Done

## Problem

Light mode is a soft pastel gallery. The reference is a poster: raw warm canvas, one vivid accent, compressed ultrabold type at architectural scale, monospace column labels, crop marks, flat surfaces layered by color instead of borders or shadows. The nav pill and footer bar have to go. Dark mode should stay what it is, minus the blurred gradient wash.

## Proposed solution

One structure, two skins. Every difference between light and dark lives in tokens on `:root` and `html[data-theme="dark"]`: colors, fonts, weights, radii, card padding, display size, divider style, feature surface.

Light (Caldera):
- Canvas pumice `#e2e2df`, surfaces limestone `#f7f6f2`, text obsidian `#070607`.
- Ember `#fc5000` is the only chromatic accent: the Ask button and the stats panel. Obsidian text on ember keeps 5.4:1 contrast.
- Sulfur `#f5f28e` for the Jev says tag. No violet, no other accents. Mood dots use gray, sulfur, ember.
- Display and headings in Archivo at width 62, weight 900 (stand in for PP Neue Corp Compact). Body DM Sans 500 only. Labels DM Mono 12px.
- Radii: cards 40px, small cards 24px, rows 16px, input 100px, pills 800px. No shadows. Cards have no border; dividers are 1.5px dotted.

Dark: keeps ink, charcoal, hairlines, Inter 400, 8px and 4px radii, periwinkle accent. Hero wash removed.

Layout (both themes):
- Hero fills the first screen. Tiny mono row on top: powered by Convex and TypeSafe on the left, built by waynesutton.ai and the theme toggle on the right. Four crop marks at the hero corners.
- Centered display headline "Ask Jev anything."
- Three columns under it like the reference: `Not a chatbot` copy, `Ask Jev` composer with Yours, and the stats panel with the odometer, progress, and four cost rows separated by dotted dividers. No nested cards.
- Wall and How it works sections keep their content, get mono labels and display headings, and sit on the canvas with dotted section dividers.
- `Nav.tsx` and `Footer.tsx` deleted. Anchor links to sections go with them; the page is short.

## Files to change

- `index.html` load Archivo, DM Sans, DM Mono from Google Fonts; keep Inter for dark; theme color
- `src/styles.css` full rewrite around the two token blocks
- `src/App.tsx` new hero structure, no Nav or Footer
- `src/components/ThemeToggle.tsx` new, mono text button with icon
- `src/components/Counter.tsx` label class
- `src/components/CostTracker.tsx` rows instead of four cards
- `src/components/Composer.tsx` label class, accent pill
- `src/components/Wall.tsx` mood dot instead of left bar, label above heading
- `src/components/HowItWorks.tsx` label above heading
- `src/hooks/useTheme.ts` theme color for the new canvas
- `src/components/Nav.tsx`, `src/components/Footer.tsx` removed

## Edge cases

- Archivo is a variable font; width comes from `font-variation-settings: "wdth" 62`. Dark sets it to `normal` so Inter is untouched.
- The headline must stay one line from 1200px up: 17 characters at width 62 is about 0.47em each, so 150px gives roughly 1200px. Clamp caps at 150px and the wrap is 1200px minus padding, so the first wrap happens around 1180px, which is fine.
- Odometer inside the ember panel: leading zeros at 28 percent opacity so they read as dim ink, not gray.
- Muted text inside the panel uses `color-mix` on `currentColor` so it works on ember and on charcoal.
- Stats panel sits at the top of its grid cell so it does not jump when Yours grows.
- 375px: single column, copy then composer then panel, no horizontal overflow.

## Verification

- 1280 by 800 light: headline, input, odometer, four cost rows above the fold, no header, no footer.
- Dark: same layout, old palette, no wash.
- 375 both themes.
- Typecheck clean. Grep for `hero__wash`, `Nav`, `Footer`, `pill--blue`, `stat--` returns nothing.

## Completion log

- 2026-09-17 06:40 UTC PRD written.
- 2026-09-17 07:00 UTC Shipped. Odometer sized with container units (`min(96px, 25cqw)` light, `min(84px, 16cqw)` dark) after Inter overflowed the dark panel at a fixed size. Crop marks moved 10px outside the text column. Answers list: question stays on one line, answer wraps. `og.png` regenerated. Verified 1280 by 800 light and dark, 375 light. Typecheck clean.
