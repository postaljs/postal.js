---
editUrl: false
next: false
prev: false
title: "resetChannels"
---

> **resetChannels**(): `void`

Defined in: [packages/postal/src/channel.ts:769](https://github.com/postaljs/postal.js/blob/950dbca686679a87f67cbbb2727e6040e9fe2ed0/packages/postal/src/channel.ts#L769)

Clears the channel registry and all RPC state. Primarily useful for test isolation.

Rejects pending RPC promises, tears down the system channel, regenerates the
instance GUID, and re-initializes a fresh system channel.

## Returns

`void`
