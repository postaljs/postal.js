import type { Plugin } from "vite";

export const umami = (): Plugin => ({
    name: "umami",
    transformIndexHtml(html) {
        if (!process.env.VITE_BASE_PATH) {
            return html;
        }
        return html.replace(
            "</head>",
            `  <script defer src="https://cloud.umami.is/script.js" data-website-id="ecd17c1f-502f-4708-bd0e-5e479c1d9189"></script>\n  </head>`
        );
    },
});
