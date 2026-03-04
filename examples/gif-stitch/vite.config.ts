import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { umami } from "../vite-plugin-umami";
import { workspaceSource } from "../vite-plugin-workspace-source";

export default defineConfig({
    plugins: [
        tailwindcss(),
        umami(),
        // Point postal imports at source TypeScript so we don't need a
        // pre-built dist/ to run the dev server.
        workspaceSource("postal", "postal-transport-messageport"),
    ],
    base: process.env.VITE_BASE_PATH || "/",
    // Target modern browsers that support module workers and top-level await.
    // This is a demo app — we don't need to support legacy environments.
    build: {
        target: "esnext",
    },
    worker: {
        // Module workers give us ESM in the worker context, which lets the
        // workspaceSource alias work the same way it does in the main thread.
        format: "es",
        rollupOptions: {
            output: {
                // esnext target required for top-level await in the worker
                inlineDynamicImports: false,
            },
        },
    },
});
