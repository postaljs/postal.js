---
editUrl: false
next: false
prev: false
title: "TransportFilter"
---

> **TransportFilter** = `object`

Defined in: [packages/postal/src/transport.ts:55](https://github.com/postaljs/postal.js/blob/4876bab634a36bab204331c97a6ba8fc6d7e22a4/packages/postal/src/transport.ts#L55)

Restricts which envelopes a transport forwards.

## Properties

### channels?

> `optional` **channels**: `string`[]

Defined in: [packages/postal/src/transport.ts:57](https://github.com/postaljs/postal.js/blob/4876bab634a36bab204331c97a6ba8fc6d7e22a4/packages/postal/src/transport.ts#L57)

Only forward envelopes on these channels. Exact match.

***

### topics?

> `optional` **topics**: `string`[]

Defined in: [packages/postal/src/transport.ts:59](https://github.com/postaljs/postal.js/blob/4876bab634a36bab204331c97a6ba8fc6d7e22a4/packages/postal/src/transport.ts#L59)

Only forward envelopes matching these topic patterns. Uses AMQP wildcard matching.
