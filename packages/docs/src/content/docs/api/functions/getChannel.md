---
editUrl: false
next: false
prev: false
title: "getChannel"
---

> **getChannel**\<`TName`\>(`name?`): [`Channel`](/api/type-aliases/channel/)\<`ResolveChannelMap`\<`TName`\>\>

Defined in: [packages/postal/src/channel.ts:723](https://github.com/postaljs/postal.js/blob/fe7a9189226397166332b0092d47ce426ac8daa9/packages/postal/src/channel.ts#L723)

Gets or creates a singleton channel by name.

The first call with a given name creates the channel. Subsequent calls
return the same instance. The `TMap` generic is compile-time only —
all call sites referencing the same channel name should use the same TMap.

## Type Parameters

### TName

`TName` _extends_ `string` = `"__default__"`

## Parameters

### name?

`TName` = `...`

The channel name (defaults to `"__default__"`)

## Returns

[`Channel`](/api/type-aliases/channel/)\<`ResolveChannelMap`\<`TName`\>\>

The singleton channel instance
