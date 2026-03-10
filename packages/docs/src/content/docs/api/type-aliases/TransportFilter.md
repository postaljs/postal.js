---
editUrl: false
next: false
prev: false
title: "TransportFilter"
---

> **TransportFilter** = `object`

Defined in: [packages/postal/src/transport.ts:55](https://github.com/postaljs/postal.js/blob/23f5a4460a742864a63b4a3c2c70dc5b7e8925ef/packages/postal/src/transport.ts#L55)

Restricts which envelopes a transport forwards.

## Properties

### channels?

> `optional` **channels**: `string`[]

Defined in: [packages/postal/src/transport.ts:57](https://github.com/postaljs/postal.js/blob/23f5a4460a742864a63b4a3c2c70dc5b7e8925ef/packages/postal/src/transport.ts#L57)

Only forward envelopes on these channels. Exact match.

***

### topics?

> `optional` **topics**: `string`[]

Defined in: [packages/postal/src/transport.ts:59](https://github.com/postaljs/postal.js/blob/23f5a4460a742864a63b4a3c2c70dc5b7e8925ef/packages/postal/src/transport.ts#L59)

Only forward envelopes matching these topic patterns. Uses AMQP wildcard matching.
