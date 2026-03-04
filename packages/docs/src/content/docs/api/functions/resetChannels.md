---
editUrl: false
next: false
prev: false
title: "resetChannels"
---

> **resetChannels**(): `void`

Defined in: [packages/postal/src/channel.ts:769](https://github.com/postaljs/postal.js/blob/19edc49e4ba8a564da1542c0e95eaed0c9393e86/packages/postal/src/channel.ts#L769)

Clears the channel registry and all RPC state. Primarily useful for test isolation.

Rejects pending RPC promises, tears down the system channel, regenerates the
instance GUID, and re-initializes a fresh system channel.

## Returns

`void`
