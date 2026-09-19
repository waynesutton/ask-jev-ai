# Wall search

Created: 2026-09-17 09:16 UTC
Last Updated: 2026-09-17 09:16 UTC
Status: Done

## Problem

The wall is a paginated feed, newest first. Once it holds a few hundred asks there is no way to find one, or to see whether a question has been asked before, without clicking Load more until it turns up.

## Solution

Convex full text search on `messages.text`, surfaced as a search pill in the wall intro.

- Schema: `searchIndex("search_text", { searchField: "text", filterFields: ["status"] })` on `messages`. Convex builds and maintains the index; no backfill step.
- `messages.search({ q })`: trims, returns `[]` for an empty query, otherwise `withSearchIndex` scoped to `status = live`, best match first, `take(24)`. Rows the admin hid are filtered out rather than masked, because a blurred card that matched your word would reveal what is under the blur. Returns `publicMessage[]`, same shape as the wall.
- UI in `Wall.tsx`: a 44px ghost circle with Phosphor `MagnifyingGlass` under the intro. Click expands it into a 360px pill input (full width under 640px) with an `X` to close. Escape also closes. The input trails the server query by 200ms so a fast typer does not fire one query per keystroke. While a query is active the label reads "N matches · best first", the grid shows the hits, and Load more is hidden. Clearing returns the live feed exactly as it was, since the paginated query never unmounted.
- The card markup moved into a `WallCard` component so the feed and the results render the same thing.

## Files changed

- `convex/schema.ts`: search index.
- `convex/messages.ts`: `search` query.
- `src/components/Wall.tsx`: search pill, debounce, results branch, `WallCard`.
- `src/styles.css`: `.search*` rules after `.intro`, reduced motion entry.

## Edge cases

- Empty or whitespace query: client skips the query, server returns `[]` if called anyway.
- Hidden rows never appear in results.
- Closed pill: input and clear button are `visibility: hidden` and `tabIndex -1`, so keyboard and screen reader users only meet the one button.
- Convex search prefix matches the last term, so `pig` finds `can pigs fly`.
- Search results are reactive like the feed: a new live ask that matches appears on its own.

## Verification

- `npx convex dev --once` built the index; `messages:search {"q":"pigs"}` returns the two matching rows, `{"q":"   "}` returns `[]`.
- Browser on dev: closed circle centered under the intro; open pill focuses the input; `pigs` shows 2 matches; `pig` also 2; `zebra` shows the empty card; Escape restores "Live · newest first" with 20 cards; dark theme picks up the 4px input radius.
- Typecheck and prettier clean.

## Log

- 2026-09-17 09:16 UTC Shipped to dev.
