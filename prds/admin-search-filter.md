# Admin search and filter, blur only hide

Created: 2026-09-17 09:45 UTC
Last Updated: 2026-09-17 09:47 UTC
Status: Done

## Problem

Two gaps in moderation.

1. `/admin` lists every row newest first with no way to find one ask or to see only the hidden or held ones. With thousands of rows, hiding a specific post means scrolling.
2. On the wall, clicking Hide does more than blur. The card swaps its dashed border on, drops the reply chip, mood, topic, cost, and the Jev answers chart, and replaces them with one "hidden by admin" line. The owner wants a hide to blur the text and leave the rest of the card alone.

## Root cause

`messages.toPublic` returns a stripped shape for hidden rows, so the card has nothing else to render. `WallCard` then branches on `hidden` for the whole meta row. `admin.list` has no filter argument and there is no admin search.

## Solution

Backend

- `schema.ts`: add `by_hidden` index on `messages.hidden` so the hidden filter is an index read, not a scan.
- `admin.ts`: `list` takes `filter: all | live | blocked | hidden` and picks the index. New `search` query over `search_text` for the admin, all statuses, with the same filter. Shared `toAdmin` mapper.
- `messages.ts`: hidden rows keep their judgment fields (reply, mood, topic, cost, latency, answers). Only `text` is masked. The words still never leave the server.

Frontend

- `Wall.tsx`: hidden cards render the full meta row and answers, plus a mono "hidden by admin" note. The blur on the text is the only visual change. Dashed border removed.
- `Admin.tsx`: a tools row under the counts. Left, a segmented filter (All, Live, Held, Hidden) in mono, ink fill on the active one. Right, a static search pill reusing the wall search styles. Search results replace the paginated list while a term is present; the filter applies to both.
- `styles.css`: `.seg` control, `.search--static`, drop `.wallcard--hidden` dashed border.

## Files

- `convex/schema.ts`
- `convex/admin.ts`
- `convex/messages.ts`
- `src/components/Wall.tsx`
- `src/components/Admin.tsx`
- `src/styles.css`

## Edge cases

- Hidden filter uses `eq("hidden", true)`; rows without the field are not hidden and fall out correctly.
- Search is capped at 30 hits; the count label says so when it hits the cap.
- Changing the filter while a search term is present keeps the term and refilters.
- The wall search still drops hidden rows, since a blurred card that matched a word would leak.

## Verification

- `npm run typecheck`
- Dev deployment: filter Hidden shows only hidden rows, Held shows only blocked, search "water" returns matches across statuses.
- Wall: hide a card, confirm only the text blurs and the chart, chips, and cost stay.

## Log

- 2026-09-17 09:45 UTC PRD written.
- 2026-09-17 09:47 UTC Built and verified on dev in the browser. Typecheck and prettier clean.
