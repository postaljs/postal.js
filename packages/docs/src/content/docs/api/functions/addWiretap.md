---
editUrl: false
next: false
prev: false
title: "addWiretap"
---

> **addWiretap**(`callback`): () => `void`

Defined in: [packages/postal/src/channel.ts:352](https://github.com/postaljs/postal.js/blob/706d026313975f926db4b6950f51ce13b27ac9c0/packages/postal/src/channel.ts#L352)

Registers a global observer that sees every envelope flowing through the bus.

Wiretaps fire for local publishes, requests, handler replies, and inbound
envelopes arriving from transports. Errors thrown by wiretaps are silently
swallowed — they must never affect message dispatch.

## Parameters

### callback

(`envelope`) => `void`

Called with the full envelope for every message

## Returns

Unsubscribe function (idempotent)

> (): `void`

### Returns

`void`
