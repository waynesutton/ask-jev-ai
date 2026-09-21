import type { ReactNode } from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

// One tooltip for the whole app. Radix handles focus, hover delay, escape,
// and positioning; the skin is a mono label on ink. Wrap the app once in
// TooltipProvider so the delay is shared across every tip.
export const TooltipProvider = RadixTooltip.Provider;

type Props = {
  // What the tip says. Keep it to one sentence.
  tip: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
};

export function Tooltip({ tip, children, side = "top" }: Props) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          className="tip"
          side={side}
          sideOffset={6}
          collisionPadding={12}
        >
          {tip}
          <RadixTooltip.Arrow className="tip__arrow" width={10} height={5} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

// A muted question mark that carries a tip. For labels that need a word of
// explanation without a sentence in the layout.
export function Hint({ tip }: { tip: ReactNode }) {
  return (
    <Tooltip tip={tip}>
      <button type="button" className="hint" aria-label="What is this?">
        ?
      </button>
    </Tooltip>
  );
}
