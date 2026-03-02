# postal

Pub/Sub message bus for JavaScript and TypeScript. Wildcard subscriptions, channel-scoped messaging, and zero dependencies.

- **Repo**: https://github.com/postaljs/postal.js
- **Version**: 3.0.0
- **License**: MIT

## Architecture

Monorepo managed by pnpm workspaces + Turborepo:

```
packages/
  postal/                             # Core library (npm: "postal")
    src/
      index.ts                            # Public exports and types
      *.test.ts                           # Tests live alongside source
  postal-transport-messageport/       # MessagePort transport (npm: "postal-transport-messageport")
  postal-transport-broadcastchannel/  # BroadcastChannel transport (npm: "postal-transport-broadcastchannel")
  docs/                               # Starlight documentation site (private, @postal/docs)
archive/                              # Legacy v2.x codebase (preserved for reference)
```

## Build / Test / Lint

```bash
pnpm install                          # Install dependencies
pnpm build                            # Build all packages (turbo)
pnpm test                             # Run all tests (turbo -> jest)
pnpm lint                             # Lint all packages (turbo -> eslint)
pnpm run checks                       # lint + test + build (CI gate)

# Package-level
pnpm --filter postal test                             # Run core lib tests only
pnpm --filter postal build                            # Build core lib only (tsdown)
pnpm --filter postal test -- --watch                  # Watch mode
pnpm --filter postal-transport-messageport test       # Run MessagePort transport tests
pnpm --filter postal-transport-broadcastchannel test  # Run BroadcastChannel transport tests
```

Build tooling: **tsdown** (bundles to CJS + ESM + .d.ts), **Jest** with ts-jest, **ESLint 9**, **Prettier**, **Husky** pre-commit hooks with lint-staged.

TypeScript 5.9+, target ES2022, strict mode.

## Core Concepts

postal is a message bus with AMQP-style topic matching:

- **Channels**: Named scopes for messages. Default channel is `"/"`.
- **Topics**: Dot-delimited strings (`"order.created"`, `"user.*.updated"`).
- **Wildcards**: `*` matches a single segment, `#` matches zero or more segments.
- **Envelopes**: Messages are wrapped in envelopes containing channel, topic, data, and metadata.
- **Subscriptions**: Subscribe to topic patterns on channels.
- **Wire taps**: Global observers that see all messages on the bus.

## Code Style

- Always use curly braces on conditionals, even single-line bodies.
- Strict equality only (`===`, `!==`).
- Arrow functions throughout. No `function` keyword in new code.
- Comments explain _why_, not _what_.
- ESM imports. The library ships CJS + ESM via tsdown.
- Zero runtime dependencies. The v2.x lodash dependency is gone.

## PR Guidelines

- Run `pnpm run checks` (lint + test + build) before submitting.
- Keep PRs focused — one concern per PR.
- Tests live in `*.test.ts` files alongside the source they test.
