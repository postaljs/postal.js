# Code Review: postal-transport-messageport

## Summary

The core transport implementation (`createMessagePortTransport`) is solid — correct interface conformance, clean resource management, no echo-prevention duplication (correctly left to the core). The handshake protocol is well-structured and the test suite covers the happy path and most failure modes thoroughly. Two genuine bugs found: a shallow envelope validation that allows malformed inbound messages to propagate as `undefined` to subscribers, and a documented error class that is never actually thrown. Several should-fix items around naming, package config, and an unused import.

## Must-Fix 🔴

- **`src/protocol.ts:59-61` — `isEnvelopeMessage` does not validate the `envelope` field exists**
    - **Why it matters**: The guard returns `true` if `type === "postal:envelope"` but does not check that the `envelope` property is present or is an object. A buggy or hostile sender can post `{ type: "postal:envelope" }` (missing `envelope`) or `{ type: "postal:envelope", envelope: null }`. After passing `isEnvelopeMessage`, `messagePortTransport.ts:33` does `const { envelope } = event.data` and then passes `envelope` to every subscriber. Subscribers receive `undefined` or `null` where they expect an `Envelope`, which will throw at access time with an unhelpful runtime error instead of being silently dropped.
    - **Suggested fix**: Add an `envelope` field check to the guard:
        ```ts
        export const isEnvelopeMessage = (data: unknown): data is EnvelopeMessage => {
            return (
                isPostalMessage(data) &&
                (data as EnvelopeMessage).type === "postal:envelope" &&
                typeof (data as EnvelopeMessage).envelope === "object" &&
                (data as EnvelopeMessage).envelope !== null
            );
        };
        ```

- **`src/errors.ts:12-18` and `src/messagePortTransport.ts:44-49` — `PostalPortClosedError` is documented as thrown on send-after-dispose but is never thrown**
    - **Why it matters**: The class JSDoc says "Thrown when attempting to send on a closed or disposed port." The `send()` implementation silently no-ops (`if (disposed) { return; }`). The class is exported as public API. Users writing `try/catch` around `send()` expecting to catch `PostalPortClosedError` get nothing. Either the error should be thrown, or the documentation should say it's a silent no-op and the error class should be removed from the public exports (or not exported at all).
    - **Suggested fix**: Pick one and be consistent. If silent no-op is the intent (which matches the test at `messagePortTransport.test.ts:131-133`), remove `PostalPortClosedError` from the public `index.ts` exports and update the JSDoc. If throwing is the intent, throw it in `send()` when `disposed === true` and update the test.

## Should-Fix 🟡

- **`src/types.ts:14-16` and `src/iframe.ts:77,86` — `targetOrigin` is semantically misnamed for `connectToParent`**
    - `ConnectOptions.targetOrigin` is documented as "Target origin for postMessage security (iframe only)." In `connectToParent`, it is used to filter incoming `event.origin` (i.e., the _source_ origin of the SYN), not as the destination for a `postMessage` call. The parameter is semantically an "expected source origin" or "allowed origin" in that context. The doc comment says "iframe only" which explicitly excludes `connectToParent` (the iframe's side), so a `connectToParent` caller has no documented signal that this option does anything useful for them. This will cause real confusion.
    - **Suggested fix**: Rename the field to `allowedOrigin` or `expectedOrigin` in `ConnectOptions`, or split the types: `IframeConnectOptions` (with `targetOrigin` for the postMessage destination) and `ParentConnectOptions` (with `allowedOrigin` for source filtering). Update JSDoc accordingly.

- **`src/iframe.ts:61` — `contentWindow!` non-null assertion with no guard**
    - `iframe.contentWindow!.postMessage(...)` — if `connectToIframe` is called before the iframe's `src` has resolved (or on a cross-origin iframe before load), `contentWindow` can be `null`. The non-null assertion suppresses the TypeScript error but doesn't protect against the runtime `TypeError: Cannot read properties of null`.
    - **Suggested fix**: Add a guard:
        ```ts
        if (!iframe.contentWindow) {
            reject(new Error("iframe.contentWindow is null — is the iframe loaded?"));
            return;
        }
        iframe.contentWindow.postMessage(createSyn(), targetOrigin, [port2]);
        ```

- **`package.json:19-25` — `exports` map uses a single `types` condition for both ESM and CJS consumers**
    - The `exports` block uses one `"types": "./dist/index.d.mts"` entry covering both `import` and `require`. TypeScript in `moduleResolution: node16` or `nodenext` mode expects `.d.cts` declarations for the `require` condition. The `.d.cts` file exists in `dist/` (tsdown generates it) but is not referenced. CJS consumers using strict module resolution will get `.d.mts` declarations which can cause type errors or incorrect types.
    - **Suggested fix**:
        ```json
        "exports": {
            ".": {
                "import": {
                    "types": "./dist/index.d.mts",
                    "default": "./dist/index.mjs"
                },
                "require": {
                    "types": "./dist/index.d.cts",
                    "default": "./dist/index.cjs"
                }
            }
        }
        ```
        Also remove the top-level `"types"` field or point it to `.d.cts` for legacy CJS tools that don't read `exports`.

- **`package.json:32` — `engines.node` version `">=22.22"` appears to be a typo**
    - Node 22 is not at patch version 22 (22.22 doesn't exist). This is likely `>=22.2.2` or simply `>=22`. As-is, no released Node version satisfies this constraint, meaning `npm install` / `pnpm install` will warn on every valid Node 22 installation.
    - **Suggested fix**: Change to `">=22"` or the specific minimum patch actually required.

- **`src/worker.ts` — `DEFAULT_TIMEOUT` constant is duplicated from `src/iframe.ts`**
    - Both files define `const DEFAULT_TIMEOUT = 5000` independently. Not a bug, but it's a convention violation — shared constants should live in a shared location (e.g., `protocol.ts` or a `constants.ts`) to prevent drift.
    - **Suggested fix**: Export `DEFAULT_TIMEOUT` from `protocol.ts` (or a dedicated `constants.ts`) and import it in both files.

## Consider 🟢

- **`src/iframe.ts:77` — `targetOrigin` from `ConnectOptions` is destructured in `connectToParent` but used only for origin filtering, not for any postMessage call**
    - The variable is named identically to the `postMessage` API's `targetOrigin` parameter, which increases confusion for the reader who has to reason about whether this is a send-side or receive-side check. A local rename after destructuring (`const { targetOrigin: allowedOrigin = DEFAULT_TARGET_ORIGIN } = options`) would at least localize the intent.

- **`src/messagePortTransport.test.ts:1` and `src/iframe.test.ts:1` and `src/worker.test.ts:1` — `export default {}` at the top of every test file**
    - This is an unusual pattern. It's present to make the files ES modules (avoiding TypeScript's `isolatedModules` complaints when using certain configurations), but it's a workaround that should probably be in `tsconfig` or jest config rather than cluttering every test file. Not wrong, but it'll confuse every dev who first opens a test file.

- **`src/iframe.test.ts` — no test covers `connectToParent` receiving a SYN with `ports.length === 0`**
    - The guard `if (isSyn(event.data) && event.ports.length > 0)` is correct code, but there's no test verifying that a SYN without a port is silently ignored (and the promise eventually times out). Not a bug — the code is defensive — but an easy edge case to add for confidence.

- **`src/worker.test.ts` — no test for `connectToHost` receiving a SYN with no port**
    - Same gap as the iframe test.

## What's Good

- The Transport interface conformance is clean. `send`, `subscribe`, and `dispose` are all correctly implemented and the `dispose` being optional on the interface is properly respected by callers in the core.
- Echo prevention is correctly left entirely to the core (`transport.ts` stamps `source` on outbound; `createInboundHandler` drops envelopes matching `instanceId`). The transport does not duplicate this logic. Good.
- The snapshot-before-iterate pattern in `onMessage` (`for (const listener of [...listeners])`) correctly handles the unsubscribe-during-delivery case.
- The unsubscribe closure's `removed` guard in `subscribe()` is idempotent. Likewise `dispose()`. Both tested.
- Namespace prefix `"postal:"` on all protocol messages is the right call — prevents silent conflicts with other `postMessage` users sharing the same scope.
- `connectToWorker` correctly omits `targetOrigin` from the options type (`Pick<ConnectOptions, "timeout">`) since workers have no origin concept. That's a tidy API boundary.
- The `isPostalMessage` / `isSyn` / `isAck` type guard chain is compositional and readable.
- The handshake cleanup on timeout (removing the listener, closing port1) prevents resource leaks on the initiator side.

## Verdict

🔴 **FAIL** — Two must-fix items: malformed inbound envelopes pass validation and propagate as `undefined` to subscribers, and a public error class is documented as thrown but never is. Fix these and address the package.json `engines` typo (which will break installs on any current Node 22 version) before shipping.
