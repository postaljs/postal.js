---
editUrl: false
next: false
prev: false
title: "resetChannels"
---

> **resetChannels**(): `void`

Defined in: [packages/postal/src/channel.ts:790](https://github.com/postaljs/postal.js/blob/e0b3285e0a41b28c5ce8193f9298ed4af990bfa1/packages/postal/src/channel.ts#L790)

Clears the channel registry and all RPC state. Primarily useful for test isolation.

Rejects pending RPC promises, tears down the system channel, regenerates the
instance GUID, and re-initializes a fresh system channel.

## Returns

`void`
