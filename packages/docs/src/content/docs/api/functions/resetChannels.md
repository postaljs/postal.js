---
editUrl: false
next: false
prev: false
title: "resetChannels"
---

> **resetChannels**(): `void`

Defined in: [packages/postal/src/channel.ts:783](https://github.com/postaljs/postal.js/blob/02349324ca9380251033ae2985f56a03db2db674/packages/postal/src/channel.ts#L783)

Clears the channel registry and all RPC state. Primarily useful for test isolation.

Rejects pending RPC promises, tears down the system channel, regenerates the
instance GUID, and re-initializes a fresh system channel.

## Returns

`void`
