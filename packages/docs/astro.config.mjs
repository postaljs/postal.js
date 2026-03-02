import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightTypeDoc, { typeDocSidebarGroup } from "starlight-typedoc";
import starlightThemeNova from "starlight-theme-nova";

export default defineConfig({
    site: "https://postal-js.org",
    vite: {
        ssr: {
            // Vite's SSR externals resolve nanoid and zod from the wrong
            // location during static generation. Bundling them inline
            // sidesteps the issue.
            noExternal: ["nanoid", "zod"],
        },
    },
    integrations: [
        starlight({
            title: "postal",
            logo: {
                light: "./src/assets/logo-light.svg",
                dark: "./src/assets/logo-dark.svg",
                replacesTitle: true,
            },
            description:
                "Pub/sub message bus for JavaScript and TypeScript. Wildcard subscriptions, channel-scoped messaging, and zero dependencies.",
            favicon: "/favicon.svg",
            head: [
                {
                    tag: "link",
                    attrs: {
                        rel: "icon",
                        href: "/favicon-32.png",
                        sizes: "32x32",
                        type: "image/png",
                    },
                },
                {
                    tag: "link",
                    attrs: {
                        rel: "icon",
                        href: "/favicon-192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                },
            ],
            customCss: ["./src/styles/custom.css"],
            plugins: [
                starlightThemeNova(),
                starlightTypeDoc({
                    entryPoints: ["../postal/src/index.ts"],
                    tsconfig: "../postal/tsconfig.json",
                }),
            ],
            social: [
                {
                    icon: "github",
                    label: "GitHub",
                    href: "https://github.com/postaljs/postal.js",
                },
                {
                    icon: "npm",
                    label: "npm",
                    href: "https://www.npmjs.com/package/postal",
                },
            ],
            sidebar: [
                {
                    label: "Guide",
                    items: [
                        { slug: "guide/introduction" },
                        { slug: "guide/getting-started" },
                        { slug: "guide/concepts" },
                        { slug: "guide/subscriptions" },
                        { slug: "guide/wiretaps" },
                        { slug: "guide/transports" },
                    ],
                },
                typeDocSidebarGroup,
                {
                    label: "Examples",
                    items: [{ slug: "examples/overview" }],
                },
                {
                    label: "Tools",
                    items: [{ slug: "tools/overview" }],
                },
                {
                    label: "Migration",
                    items: [{ slug: "migration/v2-to-v3" }],
                },
            ],
        }),
    ],
});
