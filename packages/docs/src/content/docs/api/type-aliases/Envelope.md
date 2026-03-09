---
editUrl: false
next: false
prev: false
title: "Envelope"
---

> **Envelope**\<`TPayload`\> = `object`

Defined in: [packages/postal/src/envelope.ts:19](https://github.com/postaljs/postal.js/blob/f7f08d2ed5f3d1a11bc1606b041acfcc8cde5e03/packages/postal/src/envelope.ts#L19)

Standard message wrapper used internally and exposed to subscribers.

Envelopes are the unit of communication in postal. Subscribers receive
the full envelope, and transports serialize/deserialize them when
bridging across execution boundaries.

## Type Parameters

### TPayload

`TPayload` = `unknown`

## Properties

### channel

> **channel**: `string`

Defined in: [packages/postal/src/envelope.ts:25](https://github.com/postaljs/postal.js/blob/f7f08d2ed5f3d1a11bc1606b041acfcc8cde5e03/packages/postal/src/envelope.ts#L25)

The channel this message was published on

***

### correlationId?

> `optional` **correlationId**: `string`

Defined in: [packages/postal/src/envelope.ts:37](https://github.com/postaljs/postal.js/blob/f7f08d2ed5f3d1a11bc1606b041acfcc8cde5e03/packages/postal/src/envelope.ts#L37)

Present on 'reply' envelopes — correlates back to the original request

***

### id

> **id**: `string`

Defined in: [packages/postal/src/envelope.ts:21](https://github.com/postaljs/postal.js/blob/f7f08d2ed5f3d1a11bc1606b041acfcc8cde5e03/packages/postal/src/envelope.ts#L21)

Unique message identifier (UUID v4)

***

### payload

> **payload**: `TPayload`

Defined in: [packages/postal/src/envelope.ts:29](https://github.com/postaljs/postal.js/blob/f7f08d2ed5f3d1a11bc1606b041acfcc8cde5e03/packages/postal/src/envelope.ts#L29)

The message payload

***

### replyTo?

> `optional` **replyTo**: `string`

Defined in: [packages/postal/src/envelope.ts:35](https://github.com/postaljs/postal.js/blob/f7f08d2ed5f3d1a11bc1606b041acfcc8cde5e03/packages/postal/src/envelope.ts#L35)

Present on 'request' envelopes — the topic to send the reply to

***

### source?

> `optional` **source**: `string`

Defined in: [packages/postal/src/envelope.ts:33](https://github.com/postaljs/postal.js/blob/f7f08d2ed5f3d1a11bc1606b041acfcc8cde5e03/packages/postal/src/envelope.ts#L33)

Originating context identifier, set by transports to track message origin

***

### timestamp

> **timestamp**: `number`

Defined in: [packages/postal/src/envelope.ts:31](https://github.com/postaljs/postal.js/blob/f7f08d2ed5f3d1a11bc1606b041acfcc8cde5e03/packages/postal/src/envelope.ts#L31)

When the envelope was created — Date.now() for serialization safety

***

### topic

> **topic**: `string`

Defined in: [packages/postal/src/envelope.ts:27](https://github.com/postaljs/postal.js/blob/f7f08d2ed5f3d1a11bc1606b041acfcc8cde5e03/packages/postal/src/envelope.ts#L27)

The dot-delimited topic string

***

### type

> **type**: [`EnvelopeType`](/api/type-aliases/envelopetype/)

Defined in: [packages/postal/src/envelope.ts:23](https://github.com/postaljs/postal.js/blob/f7f08d2ed5f3d1a11bc1606b041acfcc8cde5e03/packages/postal/src/envelope.ts#L23)

The kind of message
