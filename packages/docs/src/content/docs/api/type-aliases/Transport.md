---
editUrl: false
next: false
prev: false
title: "Transport"
---

> **Transport** = `object`

Defined in: [packages/postal/src/transport.ts:45](https://github.com/postaljs/postal.js/blob/706d026313975f926db4b6950f51ce13b27ac9c0/packages/postal/src/transport.ts#L45)

A transport bridges postal across execution boundaries (iframes, workers, tabs).

Implementers provide `send` (push envelopes to the remote) and `subscribe`
(receive envelopes from the remote). Postal handles the wiring — echo
prevention, filtering, and local dispatch are managed internally.

## Properties

### dispose()?

> `optional` **dispose**: () => `void`

Defined in: [packages/postal/src/transport.ts:51](https://github.com/postaljs/postal.js/blob/706d026313975f926db4b6950f51ce13b27ac9c0/packages/postal/src/transport.ts#L51)

Optional cleanup when the transport is removed or reset.

#### Returns

`void`

---

### send()

> **send**: (`envelope`, `meta?`) => `void`

Defined in: [packages/postal/src/transport.ts:47](https://github.com/postaljs/postal.js/blob/706d026313975f926db4b6950f51ce13b27ac9c0/packages/postal/src/transport.ts#L47)

Send an envelope to the remote side.

#### Parameters

##### envelope

[`Envelope`](/api/type-aliases/envelope/)

##### meta?

[`TransportSendMeta`](/api/type-aliases/transportsendmeta/)

#### Returns

`void`

---

### subscribe()

> **subscribe**: (`callback`) => () => `void`

Defined in: [packages/postal/src/transport.ts:49](https://github.com/postaljs/postal.js/blob/706d026313975f926db4b6950f51ce13b27ac9c0/packages/postal/src/transport.ts#L49)

Listen for envelopes arriving from the remote side. Returns an unsubscribe function.

#### Parameters

##### callback

(`envelope`) => `void`

#### Returns

> (): `void`

##### Returns

`void`
