import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    // src/server.ts wraps SSR so catastrophic errors render our error page.
    tanstackStart({ server: { entry: "server" } }),
    react(),
    tailwindcss(),
    nitro(),
  ],
});
