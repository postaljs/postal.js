---
editUrl: false
next: false
prev: false
title: "resetTransports"
---

> **resetTransports**(): `void`

Defined in: [packages/postal/src/transport.ts:209](https://github.com/postaljs/postal.js/blob/19edc49e4ba8a564da1542c0e95eaed0c9393e86/packages/postal/src/transport.ts#L209)

Removes all registered transports and cleans up.
Called automatically during `resetChannels()` via the `onReset` hook.
Can also be called directly for transport-only teardown.

## Returns

`void`
