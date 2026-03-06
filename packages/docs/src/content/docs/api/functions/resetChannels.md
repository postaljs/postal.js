---
editUrl: false
next: false
prev: false
title: "resetChannels"
---

> **resetChannels**(): `void`

Defined in: [packages/postal/src/channel.ts:783](https://github.com/postaljs/postal.js/blob/00b79d0443d2e7a1569b3f81cfb235a0e565115e/packages/postal/src/channel.ts#L783)

Clears the channel registry and all RPC state. Primarily useful for test isolation.

Rejects pending RPC promises, tears down the system channel, regenerates the
instance GUID, and re-initializes a fresh system channel.

## Returns

`void`
