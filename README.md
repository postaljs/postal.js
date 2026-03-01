# postal.js

Pub/Sub message bus for JavaScript and TypeScript. Wildcard subscriptions, channel-scoped messaging, and zero dependencies.

- **Repo**: https://github.com/postaljs/postal.js
- **Version**: 3.0.0
- **License**: MIT

## Architecture

Monorepo managed by pnpm workspaces + Turborepo:

```
packages/
  postal/        # Core library (npm: "postal")
    src/
      index.ts       # Public exports and types
      *.test.ts      # Tests live alongside source
archive/             # Legacy v2.x codebase (preserved for reference)
```

## Build / Test / Lint

```bash
pnpm install                    # Install dependencies
pnpm build                      # Build all packages (turbo)
pnpm test                       # Run all tests (turbo -> jest)
pnpm lint                       # Lint all packages (turbo -> eslint)
pnpm run checks                 # lint + test + build (CI gate)

# Package-level (from packages/postal/)
pnpm --filter postal test       # Run core lib tests only
pnpm --filter postal build      # Build core lib only (tsdown)
```

Build tooling: **tsdown** (bundles to CJS + ESM + .d.ts), **Jest** with ts-jest, **ESLint 9**, **Prettier**, **Husky** pre-commit hooks with lint-staged.

TypeScript 5.9+, target ES2022, strict mode.
