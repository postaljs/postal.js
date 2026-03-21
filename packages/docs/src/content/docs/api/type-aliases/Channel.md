---
editUrl: false
next: false
prev: false
title: "Channel"
---

> **Channel**\<`TMap`\> = `object`

Defined in: [packages/postal/src/channel.ts:184](https://github.com/postaljs/postal.js/blob/4876bab634a36bab204331c97a6ba8fc6d7e22a4/packages/postal/src/channel.ts#L184)

A named, typed message channel.

The optional `TMap` generic maps topic strings to their payload types.
Pub/sub topics use plain payload types. RPC topics use `{ request: X; response: Y }`.

- `publish()` only accepts pub/sub topics (RPC topics excluded at compile time)
- `request()` and `handle()` only accept RPC topics
- `subscribe()` accepts any topic — RPC topics deliver the request payload

Without a `TMap`, all payloads fall back to `unknown` and all methods accept any topic.

## Type Parameters

### TMap

`TMap` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

## Properties

### dispose()

> **dispose**: () => `void`

Defined in: [packages/postal/src/channel.ts:199](https://github.com/postaljs/postal.js/blob/4876bab634a36bab204331c97a6ba8fc6d7e22a4/packages/postal/src/channel.ts#L199)

Tear down this channel.

Clears all subscribers and handlers, rejects pending RPC promises with
`PostalDisposedError`, and removes this channel from the singleton registry.
After disposal, calling `subscribe`, `publish`, `request`, or `handle`
throws `PostalDisposedError`.

Idempotent — calling dispose() on an already-disposed channel is a no-op.
Unsubscribe/unhandle functions returned before disposal become silent no-ops.

#### Returns

`void`

***

### handle()

> **handle**: \<`TTopic`\>(`topic`, `callback`) => () => `void`

Defined in: [packages/postal/src/channel.ts:277](https://github.com/postaljs/postal.js/blob/4876bab634a36bab204331c97a6ba8fc6d7e22a4/packages/postal/src/channel.ts#L277)

Register a responder for a request topic.

The handler is registered as a specialized subscriber that only fires for
`type: "request"` envelopes. Its return value (sync or async) is wrapped
in a reply envelope and published on the internal system channel.

If the handler throws, the error is wrapped in a `PostalRpcError` and
relayed to the requester.

Only one handler per topic per channel — registering a second handler
for the same topic throws immediately.

#### Type Parameters

##### TTopic

`TTopic` *extends* `string` & `RpcTopics`\<`TMap`\>

#### Parameters

##### topic

`TTopic`

Exact topic string (must be an RPC-shaped topic in typed channels)

##### callback

(`envelope`) => `ResponsePayload`\<`TMap`\[`TTopic`\]\> \| `Promise`\<`ResponsePayload`\<`TMap`\[`TTopic`\]\>\>

Receives the request envelope, returns the response

#### Returns

Unhandle function — removes the handler, safe to call multiple times

> (): `void`

##### Returns

`void`

#### Throws

PostalDisposedError if the channel has been disposed

***

### name

> `readonly` **name**: `string`

Defined in: [packages/postal/src/channel.ts:186](https://github.com/postaljs/postal.js/blob/4876bab634a36bab204331c97a6ba8fc6d7e22a4/packages/postal/src/channel.ts#L186)

The channel's name, as provided at creation time. Readable after dispose.

***

### publish()

> **publish**: \<`TTopic`\>(`topic`, `payload`) => `void`

Defined in: [packages/postal/src/channel.ts:231](https://github.com/postaljs/postal.js/blob/4876bab634a36bab204331c97a6ba8fc6d7e22a4/packages/postal/src/channel.ts#L231)

Publish a message to all subscribers whose patterns match the topic.

Creates one envelope and delivers it to every matching subscriber.
Subscribers run independently — if any throw, the rest still execute.
Errors are collected and re-thrown as a single `AggregateError` after
all subscribers have been called.

RPC-shaped topics are excluded at compile time — use `request()` instead.

#### Type Parameters

##### TTopic

`TTopic` *extends* `string` & `PubSubTopics`\<`TMap`\>

#### Parameters

##### topic

`TTopic`

Exact topic string (no wildcards, no RPC topics)

##### payload

`TMap`\[`TTopic`\]

Message payload, type-checked against TMap when provided

#### Returns

`void`

#### Throws

PostalDisposedError if the channel has been disposed

***

### request()

> **request**: \<`TTopic`\>(`topic`, `payload`, `options?`) => `Promise`\<`ResponsePayload`\<`TMap`\[`TTopic`\]\>\>

Defined in: [packages/postal/src/channel.ts:253](https://github.com/postaljs/postal.js/blob/4876bab634a36bab204331c97a6ba8fc6d7e22a4/packages/postal/src/channel.ts#L253)

Send a request and await a response from a registered handler.

Creates a request envelope and publishes it through the channel like any
other message. Regular subscribers see the request. A registered handler
(via `handle()`) processes it and publishes a reply on the internal system
channel. The reply resolves this Promise.

Rejects with `PostalTimeoutError` if no response arrives in time.
Rejects with `PostalRpcError` if the handler throws.

#### Type Parameters

##### TTopic

`TTopic` *extends* `string` & `RpcTopics`\<`TMap`\>

#### Parameters

##### topic

`TTopic`

Exact topic string (must be an RPC-shaped topic in typed channels)

##### payload

`RequestPayload`\<`TMap`\[`TTopic`\]\>

Request payload, extracted from the RPC map entry

##### options?

[`RequestOptions`](/api/type-aliases/requestoptions/)

Request options (timeout, etc.)

#### Returns

`Promise`\<`ResponsePayload`\<`TMap`\[`TTopic`\]\>\>

Promise resolving with the handler's response

#### Throws

PostalDisposedError if the channel has been disposed

***

### subscribe()

> **subscribe**: \<`TPattern`\>(`pattern`, `callback`) => () => `void`

Defined in: [packages/postal/src/channel.ts:212](https://github.com/postaljs/postal.js/blob/4876bab634a36bab204331c97a6ba8fc6d7e22a4/packages/postal/src/channel.ts#L212)

Subscribe to messages matching a topic pattern.

The pattern can be an exact topic string or include AMQP-style
wildcards (`*` for one segment, `#` for zero or more).

#### Type Parameters

##### TPattern

`TPattern` *extends* `string`

#### Parameters

##### pattern

`TPattern`

Exact topic or wildcard pattern

##### callback

[`SubscriberCallback`](/api/type-aliases/subscribercallback/)\<`SubscribePayloadFor`\<`PayloadFor`\<`TMap`, `TPattern`\>\>\>

Called with the full envelope for each matching publish or request

#### Returns

Unsubscribe function — safe to call multiple times

> (): `void`

##### Returns

`void`

#### Throws

PostalDisposedError if the channel has been disposed
