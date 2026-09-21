import type { AnchorHTMLAttributes } from "react";
import { onLinkClick } from "../lib/router";

// An anchor that pushes instead of reloading. Renders a real <a> so the
// URL shows on hover, opens in a new tab on middle click, and works with
// no JavaScript at all.
export function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        onLinkClick(event);
      }}
    />
  );
}
