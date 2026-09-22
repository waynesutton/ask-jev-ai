# Yours as one card that clears itself

Created: 2026-09-22 08:18 UTC
Last Updated: 2026-09-22 08:37 UTC
Status: Done

## Problem

The Yours block under the composer lists up to three of your own asks and never goes away. Once the answer has landed the block is dead weight: it pushes the count panel and the wall down, and it repeats what the wall and `/me` already show. There is no way to close it.

Signed in askers have a history page. Nothing under the composer says so.

Visitor asks are public and land on the wall the moment they go live. The block under the box keeps a copy anyway, so the visitor sees the same ask twice on one screen.

## Proposed solution

Yours shows one ask, the newest. A close button sits at the end of the head row. A new ask replaces the card on its own.

Signed in: the card stays until the X or the next ask. A mono note under the card says the ask is kept in your history, with a link to `/me#me-asks`.

Visitor: once the ask is `live`, a hairline under the card drains over four seconds, then the whole block slides a step toward the wall and fades. Hovering or focusing the block holds the clock. `blocked` and `failed` cards do not fade; a held ask never reaches the wall and a failed one has a Retry button, so both wait for the X or the next ask.

A closed or faded ask is remembered in `localStorage` (`jev:yours-dismissed`) so a reload does not bring it back.

## Files to change

- `src/components/Yours.tsx`: one card, close button, history note, drain and leave animations driven by `animationend`, dismissed id in storage.
- `src/styles.css`: `.yours__head`, `.yours__close`, `.yours__note`, `.yours__drain`, `.yours--leaving`, `yours-drain` and `yours-leave` keyframes, reduced motion, coarse pointer tap area.
- `files.md`, `changelog.md`, `task.md`.

## Edge cases

- `me` is `undefined` while the session settles. The fade only starts when `me === null`, so a signed in user never sees the drain on load.
- The judging card has no drain. The clock starts when status turns `live`, so a slow judge does not cut the card before the verdict shows.
- Nested animations (`bar-grow`, the dot pulse) bubble `animationend`. Handlers check `animationName`.
- `prefers-reduced-motion`: the drain stays (it is the countdown), the leave is an opacity fade with no movement.
- Touch: "Hover to hold" is hidden under a coarse pointer.
- `localStorage` blocked: the id lives in state for the page; a reload shows the card again.

## Verification

- Visitor on dev: post an ask, see the drain start when the row turns live, hover to pause, release, block leaves after the remaining time, reload shows nothing under the box.
- Visitor: post an ask, click the X before the drain ends, block goes at once.
- Signed in: card stays, note links to `/me#me-asks`, X closes, a new ask replaces the card.
- Both skins, 375px, typecheck, prettier.

## Task completion log

- 2026-09-22 08:18 UTC PRD written.
- 2026-09-22 08:37 UTC Built and verified on dev. Visitor: "how many moons does mars have" went live, the hairline drained, the block left at about 4.5s, `jev:yours-dismissed` held the id, the wall kept the ask. X on a fresh card closed it at once and wrote storage. Signed in with a throwaway: "is coffee good for you" sat past six seconds with no hairline and the note linking `/me#me-asks`, X closed it, the linked section on `/me` listed the ask. Throwaway deleted through `/me`, gone from `users`. Focus ring on the X restored (an `outline: none` had slipped into the hover and focus rule). Not confirmed from the tool: the hover and focus pause, since Chrome drops `:focus` while the window is not focused; left in `task.md` for a hand check. Typecheck clean.
