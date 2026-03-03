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
};

export const workspaceSource = (...packages: string[]): Plugin => {
    const targets = packages.length > 0 ? packages : Object.keys(PACKAGE_SOURCES);
    const alias: Record<string, string> = {};
    for (const name of targets) {
        if (PACKAGE_SOURCES[name]) {
            alias[name] = PACKAGE_SOURCES[name];
        }
    }

    return {
        name: "workspace-source",
        config() {
            return {
                resolve: { alias },
            };
        },
    };
};
