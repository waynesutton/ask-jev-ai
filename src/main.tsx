import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import App from "./App";
import "./styles.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is missing. Run `npx convex dev` first.");
}

const convex = new ConvexReactClient(convexUrl);

// ConvexAuthProvider wraps ConvexProvider. Visitors stay anonymous; only
// the /admin page ever signs in. No OAuth, so no ambient sign ins.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider
      client={convex}
      api={{
        refreshSession: api.auth.refreshSession,
        signOut: api.auth.signOut,
      }}
      ambientSignIns={[]}
    >
      <App />
    </ConvexAuthProvider>
  </StrictMode>,
);
