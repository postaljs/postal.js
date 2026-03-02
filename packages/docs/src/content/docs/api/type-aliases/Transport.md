---
editUrl: false
next: false
prev: false
title: "Transport"
---

> **Transport** = `object`

Defined in: [packages/postal/src/transport.ts:25](https://github.com/postaljs/postal.js/blob/97682114f7b18eecf03ea0d56674dd60544f5d31/packages/postal/src/transport.ts#L25)

A transport bridges postal across execution boundaries (iframes, workers, tabs).

Implementers provide `send` (push envelopes to the remote) and `subscribe`
(receive envelopes from the remote). Postal handles the wiring — echo
prevention, filtering, and local dispatch are managed internally.

## Properties

### dispose()?

> `optional` **dispose**: () => `void`

Defined in: [packages/postal/src/transport.ts:31](https://github.com/postaljs/postal.js/blob/97682114f7b18eecf03ea0d56674dd60544f5d31/packages/postal/src/transport.ts#L31)

Optional cleanup when the transport is removed or reset.

#### Returns

`void`

---

### send()

> **send**: (`envelope`) => `void`

Defined in: [packages/postal/src/transport.ts:27](https://github.com/postaljs/postal.js/blob/97682114f7b18eecf03ea0d56674dd60544f5d31/packages/postal/src/transport.ts#L27)

Send an envelope to the remote side.

#### Parameters

##### envelope

[`Envelope`](/api/type-aliases/envelope/)

#### Returns

`void`

---

### subscribe()

> **subscribe**: (`callback`) => () => `void`

Defined in: [packages/postal/src/transport.ts:29](https://github.com/postaljs/postal.js/blob/97682114f7b18eecf03ea0d56674dd60544f5d31/packages/postal/src/transport.ts#L29)

Listen for envelopes arriving from the remote side. Returns an unsubscribe function.

#### Parameters

##### callback

(`envelope`) => `void`

#### Returns

> (): `void`

##### Returns

`void`
