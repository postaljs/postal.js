# train-dispatch

A terminal-based split-flap departure board that demonstrates postal pub/sub
messaging across Node.js worker threads using the
[`postal-transport-messageport`](../../packages/postal-transport-messageport)
package.

```
 ╔═══════╦═══════════════╦═════════╦════════╦═════════════╦═════════════╗
 ║ #     ║ DESTINATION   ║ TIME    ║ PLAT   ║ STATUS      ║ REMARKS     ║
 ╠═══════╬═══════════════╬═════════╬════════╬═════════════╬═════════════╣
 ║ 1A42  ║ MANCHESTER    ║ 06:45   ║ 3      ║ BOARDING    ║             ║
 ║ 2B17  ║ EDINBURGH     ║ 06:52   ║ 7      ║ ON TIME     ║             ║
 ║ 3C09  ║ BIRMINGHAM    ║ 07:01   ║ 1      ║ DELAYED     ║ +8 MIN      ║
 ║ 4D21  ║ LIVERPOOL     ║ 07:15   ║ 5      ║ SCHEDULED   ║             ║
 ║ 5E33  ║ BRISTOL       ║ 07:22   ║ 2      ║ HELD        ║ AWAITING PLT║
 ║ 6F48  ║ GLASGOW       ║ 07:30   ║ 4      ║ EXPECTED    ║             ║
 ║ 7G55  ║ CARDIFF       ║ 07:38   ║ 6      ║ EXPECTED    ║             ║
 ║ 8H62  ║ YORK          ║ 07:45   ║ 8      ║ EXPECTED    ║             ║
 ╚═══════╩═══════════════╩═════════╩════════╩═════════════╩═════════════╝
  ╔═ DISPATCH LOG ══════════════════════════════════════════════════════╗
  ║ 06:41:02  train.1A42.status              {"id":"1A42","status":... ║
  ║ 06:41:04  3C09 reassigned: platform 1 -> 9                         ║
  ║ 06:41:06  5E33 held: platform 2 conflict, no free platform         ║
  ╚════════════════════════════════════════════════════════════════════╝
```

The board runs in the terminal's alternate screen buffer. Every cell change
triggers a split-flap cascade animation — characters rattle through the
character set before landing on the new value, just like a real Solari board.

Press `q` (or `Ctrl-C`) to quit.

## Requirements

- Node.js 22+ (uses `worker_threads`)
- pnpm

## Running

From the repository root, install dependencies once:

```
pnpm install
```

Then start the example:

```
cd examples/train-dispatch
pnpm start
```

Or from any directory in the repo:

```
pnpm --filter @postal-examples/train-dispatch start
```

## Architecture

The simulation starts at 06:40 (simulated time) and runs at approximately 30x
real speed — one simulated minute every two real seconds.

### Main thread

`main.ts` owns three concerns:

1. **Display** — composites a full terminal frame on every render tick (~30fps)
   and writes it to stdout in a single call to avoid flicker.
2. **Dispatch controller** — monitors incoming train status messages, detects
   platform conflicts, and issues hold/reassign/clear commands.
3. **Worker management** — spawns one worker thread per active train row and
   recycles rows when a train departs.

### Worker threads

Each train runs as an independent `Worker`. Workers know nothing about each
other — they only receive commands addressed to their own train ID. The journey
lifecycle is a simple async state machine:

```
SCHEDULED -> ON TIME / DELAYED -> BOARDING -> (HELD?) -> DEPARTED
```

A random 25% chance of delay is injected per departure. Once a train departs,
the main thread terminates the worker and spawns a new one for the next
departure in the queue.

### Messaging

All communication goes through postal on the `train-dispatch` channel.
Workers connect to the main thread's postal bus via
`postal-transport-messageport`, which bridges the worker's `MessagePort` as a
postal transport. Every message — from both directions — flows through the
shared bus and is visible in the dispatch log via a wiretap on the main thread.

## Topic map

| Topic                    | Direction     | Publisher           | Payload                |
| ------------------------ | ------------- | ------------------- | ---------------------- |
| `train.<id>.status`      | worker → main | worker              | `TrainStatusPayload`   |
| `train.<id>.position`    | worker → main | worker              | `TrainPositionPayload` |
| `dispatch.<id>.hold`     | main → worker | dispatch controller | `{ reason: string }`   |
| `dispatch.<id>.clear`    | main → worker | dispatch controller | `{}`                   |
| `dispatch.<id>.platform` | main → worker | dispatch controller | `{ platform: number }` |

Wildcard subscriptions are used on both sides. Workers subscribe to
`dispatch.<id>.*` to receive all command types in a single handler. The main
thread subscribes to `train.#` to catch status and position messages from all
trains at once.

### Channel typing

This example uses `declare module "postal"` augmentation in `types.ts` to
register the topic map on the `"train-dispatch"` channel. This is the
centralized approach — define the map once, and every `getChannel("train-dispatch")`
call infers the correct payload types automatically.

Alternatively, you can skip the module augmentation and pass the type map
directly as a generic:

```typescript
import type { TrainDispatchTopicMap } from "./types.js";

const channel = getChannel<TrainDispatchTopicMap>("train-dispatch");
```

Both approaches produce the same typed channel. The module augmentation is
useful when multiple files need the same channel — the type map is resolved by
name rather than imported at each call site.

## Platform conflict resolution

When a train publishes `BOARDING`, the dispatch controller checks whether
another train already occupies that platform. If there is a conflict:

1. If a free platform exists, the incoming train is immediately reassigned and
   sent a hold-then-clear sequence so it can absorb the new platform number
   before committing to its boarding dwell.
2. If no platform is free, the train is held until one becomes available. When
   any train departs, the dispatch controller assigns the freed platform to the
   first held train and clears it.

Workers yield one event-loop tick after publishing `BOARDING` (via
`setImmediate`) so the main thread has time to detect the conflict and send a
hold command before the boarding dwell begins.

## Key files

| File                  | Purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| `src/main.ts`         | Entry point — wires everything together                   |
| `src/train-worker.ts` | Worker thread — runs one train's journey lifecycle        |
| `src/dispatch.ts`     | Platform conflict detection and resolution                |
| `src/display.ts`      | Terminal renderer — composites frames, manages cell state |
| `src/split-flap.ts`   | Split-flap character animation engine                     |
| `src/schedule.ts`     | Initial timetable and recycled departure queue            |
| `src/ansi.ts`         | ANSI escape sequence utilities                            |
| `src/types.ts`        | Shared types (safe to import in both main and worker)     |
