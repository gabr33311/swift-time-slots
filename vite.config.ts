// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Load ALL env vars (not only VITE_*) into process.env for server-side code
// (server routes / server functions). Never add these to the client define block.
const serverEnv = loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: {
        // Force the hoisted entities v4.5.0 copy (nested v7 copies break React Email SSR).
        "entities/lib/decode.js": path.resolve(rootDir, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(rootDir, "node_modules/entities/lib/encode.js"),
        entities: path.resolve(rootDir, "node_modules/entities"),
      },
    },
  },
});
