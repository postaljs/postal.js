---
editUrl: false
next: false
prev: false
title: "resetTransports"
---

> **resetTransports**(): `void`

Defined in: [packages/postal/src/transport.ts:185](https://github.com/postaljs/postal.js/blob/b7199e51a6f1e5b709f185b0f1dbde208ca2cbc3/packages/postal/src/transport.ts#L185)

Removes all registered transports and cleans up.
Called automatically during `resetChannels()` via the `onReset` hook.
Can also be called directly for transport-only teardown.

## Returns

`void`
