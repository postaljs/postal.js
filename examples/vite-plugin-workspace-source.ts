import { resolve } from "path";
import type { Plugin } from "vite";

// Resolve workspace packages to their TypeScript source during Vite dev and build.
// This bypasses the dist/ folder entirely — no separate build step needed, instant
// HMR on library changes, and no "Failed to resolve entry" errors when dist/ doesn't
// exist yet. All example apps should import this plugin in their vite.config.ts.
const EXAMPLES_DIR = import.meta.dirname;
const PACKAGES_DIR = resolve(EXAMPLES_DIR, "../packages");

const PACKAGE_SOURCES: Record<string, string> = {
    postal: resolve(PACKAGES_DIR, "postal/src/index.ts"),
    "postal-transport-messageport": resolve(
        PACKAGES_DIR,
        "postal-transport-messageport/src/index.ts"
    ),
    "postal-transport-broadcastchannel": resolve(
        PACKAGES_DIR,
        "postal-transport-broadcastchannel/src/index.ts"
    ),
    "postal-transport-serviceworker": resolve(
        PACKAGES_DIR,
        "postal-transport-serviceworker/src/index.ts"
    ),
    // Subpath export — needs its own entry so Vite resolves the /sw entrypoint
    // to source without requiring a pre-built dist/sw.mjs.
    "postal-transport-serviceworker/sw": resolve(
        PACKAGES_DIR,
        "postal-transport-serviceworker/src/sw.ts"
    ),
};

export const workspaceSource = (...packages: string[]): Plugin => {
    const targets = packages.length > 0 ? packages : Object.keys(PACKAGE_SOURCES);

    // Build alias list as an array so order is guaranteed. More-specific subpath
    // entries (e.g. "postal-transport-serviceworker/sw") must come before their
    // parent package entry ("postal-transport-serviceworker") — Vite/Rollup tests
    // aliases in order and the first match wins. A plain object doesn't guarantee
    // insertion order for the match loop, and on some Vite versions the parent
    // entry is tested first, causing "path/sw" to be resolved as
    // "dist/index.ts/sw" (ENOTDIR).
    const alias = targets
        .filter(name => Boolean(PACKAGE_SOURCES[name]))
        .sort((a, b) => b.length - a.length) // longer (more specific) keys first
        .map(name => ({ find: name, replacement: PACKAGE_SOURCES[name] }));

    return {
        name: "workspace-source",
        config() {
            return {
                resolve: { alias },
            };
        },
    };
};
