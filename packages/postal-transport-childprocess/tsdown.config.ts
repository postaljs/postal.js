import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["src/index.ts", "src/cluster.ts"],
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    minify: false,
    checks: { legacyCjs: false },
});
