---
editUrl: false
next: false
prev: false
title: "getChannel"
---

## Call Signature

> **getChannel**\<`TMap`\>(`name`): [`Channel`](/api/type-aliases/channel/)\<`TMap`\>

Defined in: [packages/postal/src/channel.ts:738](https://github.com/postaljs/postal.js/blob/00b79d0443d2e7a1569b3f81cfb235a0e565115e/packages/postal/src/channel.ts#L738)

Gets or creates a singleton channel by name.

The first call with a given name creates the channel. Subsequent calls
return the same instance. The type map generic is compile-time only —
all call sites referencing the same channel name should use the same map.

Two ways to type a channel:

1. **Explicit type map** — pass `TMap` directly:
   ```ts
   const ch = getChannel<MyTopicMap>("orders");
   ```

2. **Registry augmentation** — declare once, infer everywhere:
   ```ts
   declare module "postal" {
     interface ChannelRegistry { orders: MyTopicMap }
   }
   const ch = getChannel("orders"); // MyTopicMap inferred
   ```

### Type Parameters

#### TMap

`TMap` *extends* `Record`\<`string`, `unknown`\>

### Parameters

#### name

`string`

The channel name (defaults to `"__default__"`)

### Returns

[`Channel`](/api/type-aliases/channel/)\<`TMap`\>

The singleton channel instance

## Call Signature

> **getChannel**\<`TName`\>(`name?`): [`Channel`](/api/type-aliases/channel/)\<`ResolveChannelMap`\<`TName`\>\>

Defined in: [packages/postal/src/channel.ts:739](https://github.com/postaljs/postal.js/blob/00b79d0443d2e7a1569b3f81cfb235a0e565115e/packages/postal/src/channel.ts#L739)

Gets or creates a singleton channel by name.

The first call with a given name creates the channel. Subsequent calls
return the same instance. The type map generic is compile-time only —
all call sites referencing the same channel name should use the same map.

Two ways to type a channel:

1. **Explicit type map** — pass `TMap` directly:
   ```ts
   const ch = getChannel<MyTopicMap>("orders");
   ```

2. **Registry augmentation** — declare once, infer everywhere:
   ```ts
   declare module "postal" {
     interface ChannelRegistry { orders: MyTopicMap }
   }
   const ch = getChannel("orders"); // MyTopicMap inferred
   ```

### Type Parameters

#### TName

`TName` *extends* `string` = `"__default__"`

### Parameters

#### name?

`TName`

The channel name (defaults to `"__default__"`)

### Returns

[`Channel`](/api/type-aliases/channel/)\<`ResolveChannelMap`\<`TName`\>\>

The singleton channel instance
