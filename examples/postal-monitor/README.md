# postal-monitor

A two-terminal demo of [postal-transport-uds](../../packages/postal-transport-uds/) — a read-only Ink TUI dashboard that displays real-time task events published by independent Node processes over a Unix domain socket.

The monitor process acts as the UDS server. The launcher process spawns real monorepo commands (`pnpm --filter <pkg> test|lint|build`) and reports start/finish events via the UDS client. Tasks run concurrently with staggered launches, so the monitor shows overlapping activity.

## Requirements

- **Node.js 22+**
- **pnpm** — monorepo must have `pnpm install` run at the root
- **macOS or Linux** — Unix domain sockets are not available on Windows

## Usage

Two terminals. Monitor first, launcher second.

```bash
# Terminal 1 — start the monitor (UDS server + Ink TUI)
pnpm --filter @postal-examples/postal-monitor start:monitor

# Terminal 2 — launch tasks (UDS client + pnpm spawns)
pnpm --filter @postal-examples/postal-monitor start:launcher
```

The monitor clears the screen and renders a two-column layout: active tasks on the left, event stream on the right. Task events appear in real time as the launcher spawns and completes each command.

Press `Ctrl+C` in either terminal for clean shutdown.

## How it works

The example demonstrates a one-way event stream over postal's UDS transport:

```
┌─────────────────────────────────────────────────────────────────┐
│  MONITOR (UDS server, Ink TUI)                                  │
│                                                                 │
│  listenOnSocket("/tmp/postal-monitor.sock")                     │
│  getChannel("monitor").subscribe("task.#")                      │
│                                                                 │
│  ◄── task.started ──┐                                           │
│  ◄── task.finished ─┤                                           │
│                     │                                           │
│  State reducer      │   ┌───────────────┬───────────────────┐   │
│  → React setState   │   │ Active Tasks  │ Event Stream      │   │
│  → Ink re-render    │   │               │                   │   │
│                     │   └───────────────┴───────────────────┘   │
└─────────────────────┼───────────────────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────────────────┐
│  LAUNCHER (UDS client)                                          │
│                                                                 │
│  connectToSocket("/tmp/postal-monitor.sock")                    │
│  getChannel("monitor").publish(...)                             │
│                                                                 │
│  for each task:                                                 │
│    sleep(random 500–2000ms)                                     │
│    reportStarted({ package, command, pid })                     │
│    spawn("pnpm", ["--filter", pkg, cmd])                        │
│    wait for exit                                                │
│    reportFinished({ taskId, success, duration })                │
└─────────────────────────────────────────────────────────────────┘
```

### The reporter (the pedagogical core)

The reporter module (`src/reporter.ts`) is intentionally thin — three postal API calls and nothing else:

```ts
const disconnect = await connectToSocket(socketPath); // 1. connect
const channel = getChannel("monitor"); // 2. get channel
channel.publish("task.started", payload); // 3. publish
```

If you're reading this example to learn how to use `postal-transport-uds` in your own project, start with `reporter.ts`.

### Topic map

| Topic           | Direction          | Payload                                                        |
| --------------- | ------------------ | -------------------------------------------------------------- |
| `task.started`  | launcher → monitor | `{ taskId, package, command, pid }`                            |
| `task.finished` | launcher → monitor | `{ taskId, package, command, pid, success, duration, error? }` |

## Key files

| File                             | Purpose                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| `src/reporter.ts`                | UDS client wrapper — `connectToSocket` + `publish` (start here) |
| `src/launcher.ts`                | Entry point — spawns pnpm tasks, reports events via reporter    |
| `src/task-runner.ts`             | Task spawn logic — `child_process.spawn` + reporter calls       |
| `src/monitor.tsx`                | Entry point — UDS server, postal subscriptions, Ink render      |
| `src/monitor-state.ts`           | Pure state reducer for task events                              |
| `src/components/App.tsx`         | Root layout — two-column bordered panels                        |
| `src/components/ProcessList.tsx` | Left panel — active tasks grouped by PID                        |
| `src/components/EventStream.tsx` | Right panel — scrolling event log                               |
| `src/types.ts`                   | Payload types + `ChannelRegistry` augmentation                  |
