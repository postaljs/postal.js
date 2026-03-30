---
editUrl: false
next: false
prev: false
title: "resetChannels"
---

> **resetChannels**(): `void`

Defined in: [packages/postal/src/channel.ts:790](https://github.com/postaljs/postal.js/blob/8f1628831582994e271d514bcf60125bd6a53fa1/packages/postal/src/channel.ts#L790)

Clears the channel registry and all RPC state. Primarily useful for test isolation.

Rejects pending RPC promises, tears down the system channel, regenerates the
instance GUID, and re-initializes a fresh system channel.

## Returns

`void`
