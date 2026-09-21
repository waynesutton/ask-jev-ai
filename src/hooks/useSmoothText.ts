import { useEffect, useRef, useState } from "react";

// Pace streamed text so a card reads instead of jumping. Pass the full text
// each render; the hook reveals it a few characters per frame and catches
// up at once when streaming is off. Kept local so the wall does not pull
// the agent's React bundle (and the AI SDK behind it) just for this.
export function useSmoothText(
  text: string,
  { charsPerSec = 160, streaming = false } = {},
): string {
  const [cursor, setCursor] = useState(streaming ? 0 : text.length);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!streaming) {
      setCursor(text.length);
      last.current = null;
      return;
    }
    if (cursor >= text.length) return;
    let frame = 0;
    const tick = (now: number) => {
      const dt = last.current === null ? 16 : now - last.current;
      last.current = now;
      setCursor((c) =>
        Math.min(text.length, c + Math.max(1, (charsPerSec * dt) / 1000)),
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, streaming, charsPerSec, cursor]);

  return text.slice(0, Math.floor(cursor));
}
