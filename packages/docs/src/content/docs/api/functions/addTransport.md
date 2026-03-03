---
editUrl: false
next: false
prev: false
title: "addTransport"
---

> **addTransport**(`transport`, `options?`): () => `void`

Defined in: [packages/postal/src/transport.ts:173](https://github.com/postaljs/postal.js/blob/ce385092ed93b7b9761ddacc65bbc4af0423befa/packages/postal/src/transport.ts#L173)

Registers a transport with postal.

The transport will receive outbound envelopes (filtered by options) and
can inject inbound envelopes into the local bus. Returns a function
that removes this transport.

## Parameters

### transport

[`Transport`](/api/type-aliases/transport/)

The transport to register

### options?

[`TransportOptions`](/api/type-aliases/transportoptions/)

Optional filter configuration

## Returns

A remove function (idempotent)

> (): `void`

### Returns

`void`
