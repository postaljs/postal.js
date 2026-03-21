---
editUrl: false
next: false
prev: false
title: "resetChannels"
---

> **resetChannels**(): `void`

Defined in: [packages/postal/src/channel.ts:789](https://github.com/postaljs/postal.js/blob/4876bab634a36bab204331c97a6ba8fc6d7e22a4/packages/postal/src/channel.ts#L789)

Clears the channel registry and all RPC state. Primarily useful for test isolation.

Rejects pending RPC promises, tears down the system channel, regenerates the
instance GUID, and re-initializes a fresh system channel.

## Returns

`void`
