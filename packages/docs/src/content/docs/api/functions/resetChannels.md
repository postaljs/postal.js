---
editUrl: false
next: false
prev: false
title: "resetChannels"
---

> **resetChannels**(): `void`

Defined in: [packages/postal/src/channel.ts:783](https://github.com/postaljs/postal.js/blob/f7f08d2ed5f3d1a11bc1606b041acfcc8cde5e03/packages/postal/src/channel.ts#L783)

Clears the channel registry and all RPC state. Primarily useful for test isolation.

Rejects pending RPC promises, tears down the system channel, regenerates the
instance GUID, and re-initializes a fresh system channel.

## Returns

`void`
