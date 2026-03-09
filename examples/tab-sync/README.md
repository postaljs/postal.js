# tab-sync

A browser dashboard that syncs authentication, theme, and preferences across open tabs in real time using postal's BroadcastChannel transport. Open the same URL in two or more tabs and changes in one tab immediately appear in all the others.

The key teaching point is **dual transports on one postal instance**: BroadcastChannel handles fast tab-to-tab fan-out; a ServiceWorker MessagePort handles point-to-point presence coordination. Both transports share the same `"sync"` channel and the same subscribers.

## Requirements

- Node.js 22+
- pnpm
- A browser with BroadcastChannel and ServiceWorker support (Chrome, Firefox, Safari 16+)

## Running

From the repository root, install dependencies once:

```
pnpm install
```

Then start the dev server:

```
pnpm --filter @postal-examples/tab-sync dev
```

Open `http://localhost:5173` in two or more tabs. Interact with the Auth, Theme, or Preferences controls in one tab — the others update immediately. The "Tabs:" counter in the header shows the live connected-tab count from the ServiceWorker.

## Architecture

State flows through three layers:

- **localStorage** — authoritative persistence. A new tab hydrates from storage on load via `loadState()` and renders the correct state immediately, even if no other tabs are open.
- **BroadcastChannel (postal transport)** — real-time notification. When any tab publishes a state change, the transport fans it out to all other open tabs via the browser's `BroadcastChannel` API.
- **ServiceWorker MessagePort (postal transport)** — presence coordination. Each tab opens a dedicated `MessageChannel` to the SW. The SW queries `clients.matchAll()` on each connect/disconnect and publishes the current tab count back to all connected tabs.

The SW runs in its own JS context with its own postal instance. It does not share the tab's bus — messages cross the boundary through the MessagePort transport.

### Responsibility split

```
main.ts      All postal API calls. Subscriptions, publishes, transport setup,
             wiretap. The entire postal surface is visible in one file.

ui.ts        Pure DOM manipulation. No postal imports. main.ts wires postal
             callbacks to these functions.

state.ts     AppState type and localStorage helpers. No postal, no DOM.

src/sw.ts    ServiceWorker entry. Calls listenForClients() to set up the
             MessagePort transport layer, then tracks presence by querying
             clients.matchAll() on each syn/close event.
```

### Echo prevention

Outbound envelopes are stamped with `source: instanceId` by postal core. Inbound envelopes matching the local instance ID are dropped before subscribers fire. This means user actions can just publish — subscribers handle all state mutation regardless of whether the message originated locally or arrived from another tab.

## Topic map

| Topic                  | Direction     | Publisher     | Payload                                       |
| ---------------------- | ------------- | ------------- | --------------------------------------------- |
| `auth.login`           | tab broadcast | any tab       | `{ username: string, tabId: string }`         |
| `auth.logout`          | tab broadcast | any tab       | `{ tabId: string }`                           |
| `theme.changed`        | tab broadcast | any tab       | `{ theme: "light" \| "dark", tabId: string }` |
| `prefs.changed`        | tab broadcast | any tab       | `{ prefs: Prefs, tabId: string }`             |
| `sync.clients.changed` | SW → all tabs | ServiceWorker | `{ count: number }`                           |

All topics live on the `"sync"` channel. No wildcards are used — every subscription is an exact topic match.

### State persistence pattern

`localStorage` holds the authoritative state. Subscribers write to storage after every state change:

```
User action → publish → subscriber → saveState() + applyState()
                                         ↑
                    (same path whether local or remote)
```

A new tab that opens while others are running calls `loadState()` on startup and renders the current state before the postal transport even connects.

## Key files

| File             | Purpose                                                                          |
| ---------------- | -------------------------------------------------------------------------------- |
| `src/main.ts`    | Entry point — all postal calls: transport setup, channel, subscriptions, wiretap |
| `src/ui.ts`      | DOM manipulation — no postal dependency, wired by main.ts                        |
| `src/state.ts`   | AppState type, `loadState()` / `saveState()` via localStorage                    |
| `src/sw.ts`      | ServiceWorker — MessagePort transport setup and presence tracking                |
| `index.html`     | UI structure — Auth, Theme, Preferences panels and Activity Log                  |
| `vite.config.ts` | Build config — SW entry point wiring and dev-server URL rewrite for `/sw.js`     |

## What this demonstrates (postal features)

- **BroadcastChannel transport** — `createBroadcastChannelTransport()` + `addTransport()` is all the setup required. Any tab that opens the same-named channel joins the mesh automatically.
- **ServiceWorker MessagePort transport** — `connectToServiceWorker()` performs a `MessageChannel` handshake so the tab gets a dedicated port to the SW, separate from broadcast traffic.
- **Dual transports, one instance** — BroadcastChannel and ServiceWorker MessagePort run simultaneously on the same postal instance. Subscribers don't know or care which transport delivered a message.
- **Channel-scoped pub/sub** — all messaging goes through `getChannel("sync")`, keeping topics namespaced.
- **Wiretap as an observability hook** — the Activity Log is driven entirely by `addWiretap()`. It sees both local publishes and messages arriving from other tabs with zero coupling to the state subscribers.
- **Echo prevention** — built into postal core; tabs don't receive their own outbound messages back from the transport.
- **Exact topic matching** — no wildcards. Every subscription names a specific topic, keeping the message contract explicit.
