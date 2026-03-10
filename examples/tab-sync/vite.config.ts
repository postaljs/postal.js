import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { umami } from "../vite-plugin-umami";
import { workspaceSource } from "../vite-plugin-workspace-source";

// Vite's dev server doesn't serve Rollup input entries at their output paths.
// The SW registration expects /sw.js but the source lives at src/sw.ts.
// This plugin rewrites the URL during dev so Vite's transform pipeline picks
// up the TypeScript source and serves it as JS at the path the browser expects.
const swDevMiddleware = (): Plugin => ({
    name: "sw-dev-middleware",
    configureServer(server) {
        server.middlewares.use((req, _res, next) => {
            if (req.url === "/sw.js") {
                req.url = "/src/sw.ts";
            }
            next();
        });
    },
});

export default defineConfig({
    plugins: [
        tailwindcss(),
        umami(),
        swDevMiddleware(),
        // Point postal imports at source TypeScript so we don't need a
        // pre-built dist/ to run the dev server.
        workspaceSource(
            "postal",
            "postal-transport-broadcastchannel",
            "postal-transport-serviceworker",
            "postal-transport-serviceworker/sw",
            "postal-transport-messageport"
        ),
    ],
    base: process.env.VITE_BASE_PATH || "/",
    build: {
        target: "esnext",
        rollupOptions: {
            input: {
                main: "index.html",
                sw: "src/sw.ts",
            },
            output: {
                // SW must land at /sw.js with no hash and no assets/ prefix —
                // scope is determined by the file's URL, not its registration path.
                // Everything else keeps the default hashed-asset naming.
                entryFileNames: chunk =>
                    chunk.name === "sw" ? "sw.js" : "assets/[name]-[hash].js",
            },
        },
    },
});
