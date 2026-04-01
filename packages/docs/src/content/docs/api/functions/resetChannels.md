---
editUrl: false
next: false
prev: false
title: "resetChannels"
---

> **resetChannels**(): `void`

Defined in: [packages/postal/src/channel.ts:790](https://github.com/postaljs/postal.js/blob/3a48d1507e895e76d727fc66b665bbd287a62582/packages/postal/src/channel.ts#L790)

Clears the channel registry and all RPC state. Primarily useful for test isolation.

Rejects pending RPC promises, tears down the system channel, regenerates the
instance GUID, and re-initializes a fresh system channel.

## Returns

`void`
