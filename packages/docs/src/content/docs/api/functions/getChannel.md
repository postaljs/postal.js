---
editUrl: false
next: false
prev: false
title: "getChannel"
---

> **getChannel**\<`TName`\>(`name`): [`Channel`](/api/type-aliases/channel/)\<`ResolveChannelMap`\<`TName`\>\>

Defined in: [packages/postal/src/channel.ts:723](https://github.com/postaljs/postal.js/blob/950dbca686679a87f67cbbb2727e6040e9fe2ed0/packages/postal/src/channel.ts#L723)

Gets or creates a singleton channel by name.

The first call with a given name creates the channel. Subsequent calls
return the same instance. The `TMap` generic is compile-time only —
all call sites referencing the same channel name should use the same TMap.

## Type Parameters

### TName

`TName` _extends_ `string`

## Parameters

### name

`TName`

The channel name

## Returns

[`Channel`](/api/type-aliases/channel/)\<`ResolveChannelMap`\<`TName`\>\>

The singleton channel instance
