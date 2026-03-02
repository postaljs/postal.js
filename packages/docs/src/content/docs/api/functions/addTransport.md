---
editUrl: false
next: false
prev: false
title: "addTransport"
---

> **addTransport**(`transport`, `options?`): () => `void`

Defined in: [packages/postal/src/transport.ts:149](https://github.com/postaljs/postal.js/blob/97682114f7b18eecf03ea0d56674dd60544f5d31/packages/postal/src/transport.ts#L149)

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
