---
editUrl: false
next: false
prev: false
title: "resetTransports"
---

> **resetTransports**(): `void`

Defined in: [packages/postal/src/transport.ts:185](https://github.com/postaljs/postal.js/blob/97682114f7b18eecf03ea0d56674dd60544f5d31/packages/postal/src/transport.ts#L185)

Removes all registered transports and cleans up.
Called automatically during `resetChannels()` via the `onReset` hook.
Can also be called directly for transport-only teardown.

## Returns

`void`
