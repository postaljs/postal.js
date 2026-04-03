---
editUrl: false
next: false
prev: false
title: "ChannelRegistry"
---

Defined in: [packages/postal/src/channel.ts:42](https://github.com/postaljs/postal.js/blob/e0b3285e0a41b28c5ce8193f9298ed4af990bfa1/packages/postal/src/channel.ts#L42)

Augmentable interface for global channel type registration.

Users can declare their channel maps once via module augmentation
and get automatic payload inference on `getChannel()` without
passing a generic at every call site:

```ts
declare module 'postal' {
  interface ChannelRegistry {
    orders: { 'item.placed': { sku: string } };
  }
}

const orders = getChannel('orders'); // Channel<{ 'item.placed': { sku: string } }>
```

Channels not in the registry fall back to `Record<string, unknown>` (untyped).
