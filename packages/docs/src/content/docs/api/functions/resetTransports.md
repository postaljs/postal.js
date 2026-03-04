---
editUrl: false
next: false
prev: false
title: "resetTransports"
---

> **resetTransports**(): `void`

Defined in: [packages/postal/src/transport.ts:209](https://github.com/postaljs/postal.js/blob/a09296b72122873f0a52c46759caad32c92c0ffd/packages/postal/src/transport.ts#L209)

Removes all registered transports and cleans up.
Called automatically during `resetChannels()` via the `onReset` hook.
Can also be called directly for transport-only teardown.

## Returns

`void`
