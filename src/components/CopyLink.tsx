import { useEffect, useRef, useState } from "react";
import { Check, Link as LinkIcon } from "@phosphor-icons/react";
import type { Id } from "../../convex/_generated/dataModel";
import { Tooltip } from "./Tooltip";

// Copy the /a/:id link for one ask. The timestamp already links there, but
// nobody reads a timestamp as a link. One tap, "Copied" for a beat, done.
export function CopyLink({ messageId }: { messageId: Id<"messages"> }) {
  // "done" swaps the label to Copied; "failed" says so instead of staying
  // silent when both clipboard paths are blocked.
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const copied = state === "done";
  const timer = useRef<number | null>(null);

  const flash = (next: "done" | "failed") => {
    setState(next);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1500);
  };

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    const url = `${window.location.origin}/a/${messageId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API blocked (http, permissions). The old selection copy
      // still works nearly everywhere and needs no browser dialog.
      const box = document.createElement("textarea");
      box.value = url;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(box);
      if (!ok) {
        flash("failed");
        return;
      }
    }
    flash("done");
  };

  const word =
    state === "done"
      ? "Copied"
      : state === "failed"
        ? "Could not copy"
        : "Link";

  return (
    <Tooltip tip={copied ? "Copied" : "Copy a link to this ask"}>
      <button
        type="button"
        className={"copylink" + (copied ? " copylink--done" : "")}
        onClick={() => void copy()}
        aria-label={copied ? "Link copied" : "Copy a link to this ask"}
      >
        {copied ? (
          <Check size={12} weight="bold" aria-hidden="true" />
        ) : (
          <LinkIcon size={12} aria-hidden="true" />
        )}
        <span className="copylink__word" aria-live="polite">
          {word}
        </span>
      </button>
    </Tooltip>
  );
}
