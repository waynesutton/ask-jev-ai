import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "@phosphor-icons/react";

// How far from either end before an arrow is worth showing. Below this the
// destination is already on screen and the button would be noise.
const EDGE = 320;

// Two floating arrows, fixed to the right edge. Top shows once the hero has
// scrolled away; bottom hides once the colophon is in reach. Scrolling uses
// the page's own scroll-behavior, so reduced motion turns it instant.
export function ScrollArrows() {
  const [{ canUp, canDown }, setState] = useState(() => read());

  useEffect(() => {
    const update = () => setState(read());
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const toTop = () => window.scrollTo({ top: 0 });
  const toBottom = () =>
    window.scrollTo({ top: document.documentElement.scrollHeight });

  return (
    <div className="scroll-arrows" aria-label="Page navigation">
      <button
        type="button"
        className={"scroll-arrows__btn" + (canUp ? "" : " is-hidden")}
        onClick={toTop}
        aria-label="Scroll to top"
        tabIndex={canUp ? 0 : -1}
      >
        <ArrowUp size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={"scroll-arrows__btn" + (canDown ? "" : " is-hidden")}
        onClick={toBottom}
        aria-label="Scroll to bottom"
        tabIndex={canDown ? 0 : -1}
      >
        <ArrowDown size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

function read(): { canUp: boolean; canDown: boolean } {
  if (typeof window === "undefined") return { canUp: false, canDown: false };
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return { canUp: y > EDGE, canDown: max - y > EDGE };
}
