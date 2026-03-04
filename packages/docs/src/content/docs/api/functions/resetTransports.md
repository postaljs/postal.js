---
editUrl: false
next: false
prev: false
title: "resetTransports"
---

> **resetTransports**(): `void`

Defined in: [packages/postal/src/transport.ts:250](https://github.com/postaljs/postal.js/blob/fe7a9189226397166332b0092d47ce426ac8daa9/packages/postal/src/transport.ts#L250)

Removes all registered transports and cleans up.
Called automatically during `resetChannels()` via the `onReset` hook.
Can also be called directly for transport-only teardown.

## Returns

`void`
