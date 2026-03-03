import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { workspaceSource } from "../vite-plugin-workspace-source";

export default defineConfig({
    plugins: [
        tailwindcss(),
        // Point postal imports at source TypeScript so we don't need a
        // pre-built dist/ to run the dev server.
        workspaceSource("postal"),
    ],
    base: process.env.VITE_BASE_PATH || "/",
    build: {
        target: "esnext",
    },
});
