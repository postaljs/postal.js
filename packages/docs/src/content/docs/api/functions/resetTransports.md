---
editUrl: false
next: false
prev: false
title: "resetTransports"
---

> **resetTransports**(): `void`

Defined in: [packages/postal/src/transport.ts:250](https://github.com/postaljs/postal.js/blob/3a48d1507e895e76d727fc66b665bbd287a62582/packages/postal/src/transport.ts#L250)

Removes all registered transports and cleans up.
Called automatically during `resetChannels()` via the `onReset` hook.
Can also be called directly for transport-only teardown.

## Returns

`void`
