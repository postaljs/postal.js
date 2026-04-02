---
editUrl: false
next: false
prev: false
title: "getChannel"
---

## Call Signature

> **getChannel**\<`TMap`\>(`name`): [`Channel`](/api/type-aliases/channel/)\<`TMap`\>

Defined in: [packages/postal/src/channel.ts:745](https://github.com/postaljs/postal.js/blob/4d190f17ca00a7479e2eb67edf7dc9d3556f05e1/packages/postal/src/channel.ts#L745)

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

Defined in: [packages/postal/src/channel.ts:746](https://github.com/postaljs/postal.js/blob/4d190f17ca00a7479e2eb67edf7dc9d3556f05e1/packages/postal/src/channel.ts#L746)

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
