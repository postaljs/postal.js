---
editUrl: false
next: false
prev: false
title: "resetTransports"
---

> **resetTransports**(): `void`

Defined in: [packages/postal/src/transport.ts:250](https://github.com/postaljs/postal.js/blob/4d190f17ca00a7479e2eb67edf7dc9d3556f05e1/packages/postal/src/transport.ts#L250)

Removes all registered transports and cleans up.
Called automatically during `resetChannels()` via the `onReset` hook.
Can also be called directly for transport-only teardown.

## Returns

`void`
