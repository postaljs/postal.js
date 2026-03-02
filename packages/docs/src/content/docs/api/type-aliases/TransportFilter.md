---
editUrl: false
next: false
prev: false
title: "TransportFilter"
---

> **TransportFilter** = `object`

Defined in: [packages/postal/src/transport.ts:35](https://github.com/postaljs/postal.js/blob/97682114f7b18eecf03ea0d56674dd60544f5d31/packages/postal/src/transport.ts#L35)

Restricts which envelopes a transport forwards.

## Properties

### channels?

> `optional` **channels**: `string`[]

Defined in: [packages/postal/src/transport.ts:37](https://github.com/postaljs/postal.js/blob/97682114f7b18eecf03ea0d56674dd60544f5d31/packages/postal/src/transport.ts#L37)

Only forward envelopes on these channels. Exact match.

---

### topics?

> `optional` **topics**: `string`[]

Defined in: [packages/postal/src/transport.ts:39](https://github.com/postaljs/postal.js/blob/97682114f7b18eecf03ea0d56674dd60544f5d31/packages/postal/src/transport.ts#L39)

Only forward envelopes matching these topic patterns. Uses AMQP wildcard matching.
