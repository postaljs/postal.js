---
editUrl: false
next: false
prev: false
title: "TransportFilter"
---

> **TransportFilter** = `object`

Defined in: [packages/postal/src/transport.ts:35](https://github.com/postaljs/postal.js/blob/b7199e51a6f1e5b709f185b0f1dbde208ca2cbc3/packages/postal/src/transport.ts#L35)

Restricts which envelopes a transport forwards.

## Properties

### channels?

> `optional` **channels**: `string`[]

Defined in: [packages/postal/src/transport.ts:37](https://github.com/postaljs/postal.js/blob/b7199e51a6f1e5b709f185b0f1dbde208ca2cbc3/packages/postal/src/transport.ts#L37)

Only forward envelopes on these channels. Exact match.

---

### topics?

> `optional` **topics**: `string`[]

Defined in: [packages/postal/src/transport.ts:39](https://github.com/postaljs/postal.js/blob/b7199e51a6f1e5b709f185b0f1dbde208ca2cbc3/packages/postal/src/transport.ts#L39)

Only forward envelopes matching these topic patterns. Uses AMQP wildcard matching.
