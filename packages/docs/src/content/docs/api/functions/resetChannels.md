---
editUrl: false
next: false
prev: false
title: "resetChannels"
---

> **resetChannels**(): `void`

Defined in: [packages/postal/src/channel.ts:783](https://github.com/postaljs/postal.js/blob/23f5a4460a742864a63b4a3c2c70dc5b7e8925ef/packages/postal/src/channel.ts#L783)

Clears the channel registry and all RPC state. Primarily useful for test isolation.

Rejects pending RPC promises, tears down the system channel, regenerates the
instance GUID, and re-initializes a fresh system channel.

## Returns

`void`
