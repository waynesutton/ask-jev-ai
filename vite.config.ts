import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// STATIC_HOSTING_BASE_PATH is set by @convex-dev/static-hosting when it runs
// the build. Root mounted apps get "/".
export default defineConfig({
  plugins: [react()],
  base: process.env.STATIC_HOSTING_BASE_PATH ?? "/",
});
