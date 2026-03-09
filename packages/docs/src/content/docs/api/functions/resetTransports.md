---
editUrl: false
next: false
prev: false
title: "resetTransports"
---

> **resetTransports**(): `void`

Defined in: [packages/postal/src/transport.ts:250](https://github.com/postaljs/postal.js/blob/f7f08d2ed5f3d1a11bc1606b041acfcc8cde5e03/packages/postal/src/transport.ts#L250)

Removes all registered transports and cleans up.
Called automatically during `resetChannels()` via the `onReset` hook.
Can also be called directly for transport-only teardown.

## Returns

`void`
