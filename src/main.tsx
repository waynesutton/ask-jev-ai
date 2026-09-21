import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { oauth } from "@convex-dev/auth/providers/oauth/react";
import { OauthError } from "./components/OauthError";
import { api } from "../convex/_generated/api";
import App from "./App";
import { TooltipProvider } from "./components/Tooltip";
import "./styles.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is missing. Run `npx convex dev` first.");
}

const convex = new ConvexReactClient(convexUrl);

// ConvexAuthProvider wraps ConvexProvider. Visitors stay anonymous until
// they sign in. Ambient OAuth completes callbacks on any return page.
// TooltipProvider shares one hover delay across every tip.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider
      client={convex}
      api={{
        refreshSession: api.auth.refreshSession,
        signOut: api.auth.signOut,
      }}
      ambientSignIns={[oauth()]}
    >
      <TooltipProvider delayDuration={250}>
        <OauthError />
        <App />
      </TooltipProvider>
    </ConvexAuthProvider>
  </StrictMode>,
);
