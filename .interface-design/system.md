# Ask Jev interface system

Saved: 2026-09-22 08:05 UTC

Two skins share one token contract. Every visual difference lives in the token blocks at the top of `src/styles.css`. Components never carry a raw hex; they read tokens.

## Direction and feel

A judge, not a chatbot. The product is a wall of short asks and one machine's verdict on each. The interface should feel like a printed ledger that happens to be live: mono labels, tabular numbers, one accent that means "this is the verdict", and plenty of paper.

- Light (Caldera): limestone canvas, paper cards, ink text, ember accent, sulfur tag. Dotted dividers. Cards have no border; the tone shift does the work.
- Dark: charcoal canvas, near black cards with hairlines, pale blue accent and tag. Solid hairline dividers. Borders carry the edge because tone shifts vanish on dark.

## Tokens that matter

Surfaces: `--canvas` (page), `--paper` (card), `--stage` (inset well inside a card, a hair under canvas in light, canvas in dark). Text: `--ink`, `--muted` (0.64), `--faint` (0.4). Edges: `--hairline` (0.12 to 0.14), `--divider`, `--card-border` (transparent in light, hairline in dark). One accent: `--accent`. One tag: `--tag`.

Type: `--font-display` for headings, `--font-body` for copy, `--font-mono` for labels, numbers, chips, and anything the machine said. Scale 12 / 14 / 16 / 20 / 24 / 32.

Space: multiples of 4, named `--space-4` through `--space-80`. Radius: `--radius-card` 40 (light) or 8 (dark), `--radius-card-sm` 24, `--radius-small` 16, `--radius-pill`.

## Depth strategy

Surface color shifts. No shadows anywhere. A card is paper on canvas; an inset is stage on paper. Dark mode adds hairlines through `--card-border` because the shifts are too quiet to see alone. Do not add a shadow to fix a contrast problem; move the surface one step on the token ladder instead.

## Patterns

### Explainer as step cards (`HowItWorks.tsx`, `.how*`)

When a section has to explain a flow, do not write paragraphs. Head on the left (label, heading, two sentence subheading, one pill and one ghost), an `<ol>` of cards on the right, `minmax(240px, 3fr) 9fr`, gap 48.

Each card: `.card` padding 12, a `.how__stage` on top (fixed 184px height, `--stage` background, `--radius-small`, padding 16 top and left, `overflow: hidden`), then `.how__copy` (padding 20 12 12) holding a mono number, a bold body title, a muted body-sm paragraph, and one underlined mono link out.

The stage shows the product's own primitives in miniature, never an illustration. Mini cards are `calc(100% + 24px)` wide so they bleed off the right edge like a print crop. Reuse the real classes (`.tag`, `.chip`, `.answers__*`, `.dot--pulse`) so a redesign of the primitive redraws the explainer for free. Content in a stage is one honest example; numbers and names come from the enforcing constants.

Motion in stages: caret `blink 1s steps(1)`, tab dots `pulse 1.8s ease-in-out` staggered 0.3s, the live dot reuses `.dot--pulse`. All stop under `prefers-reduced-motion`.

Breakpoints: 1100 head above cards, 800 cards in one column, 520 numbers stack. When flipping a flex row to a column, also reset `align-items` to `stretch` and any fixed `flex-basis` on the label, or the label becomes a tall empty block.

### Ruled rows (`.how__row`)

A dotted (light) or hairline (dark) rule on top, padding 24 above, 40 below the thing before it. Left: an 88px mono label. Right: the content. Used twice under the step cards: link chips and number pairs. Good for any "footnotes to a section" moment.

### Link chips (`.how__link`)

Mono, 7 by 12 padding, hairline border, pill radius, arrow glyph at 11px. Hover and focus invert to ink on `--on-dark`. Use for a row of outbound docs links. Every outbound anchor is `target="_blank" rel="noreferrer"`; internal routes use `Link`.

### Number pairs (`.how__num`)

`<dl>` grid, four columns, mono label over body-sm value. Values are template strings built from imported constants, joined with `·`. Never type a number the server also enforces.

### Verdict chip and quiet tag

`.tag` is the verdict: `--tag` fill, `--on-tag` text, mono, with the percent in `.tag__pct`. `.tag--quiet` is the secondary read (lean, close call): hairline border, no fill. One filled tag per card, at most.

## Copy rules for UI

Sentence case everywhere. Labels are mono and short ("Built on", "Jev price"). Link text says where it goes ("Realtime in Convex"), never "Learn more". No emoji, no dashes between words. Every figure in copy is imported, not typed.
