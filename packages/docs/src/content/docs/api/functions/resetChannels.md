---
editUrl: false
next: false
prev: false
title: "resetChannels"
---

> **resetChannels**(): `void`

Defined in: [packages/postal/src/channel.ts:769](https://github.com/postaljs/postal.js/blob/fe7a9189226397166332b0092d47ce426ac8daa9/packages/postal/src/channel.ts#L769)

Clears the channel registry and all RPC state. Primarily useful for test isolation.

Rejects pending RPC promises, tears down the system channel, regenerates the
instance GUID, and re-initializes a fresh system channel.

## Returns

`void`
