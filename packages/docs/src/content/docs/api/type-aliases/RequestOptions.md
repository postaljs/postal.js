---
editUrl: false
next: false
prev: false
title: "RequestOptions"
---

> **RequestOptions** = `object`

Defined in: [packages/postal/src/channel.ts:154](https://github.com/postaljs/postal.js/blob/8f1628831582994e271d514bcf60125bd6a53fa1/packages/postal/src/channel.ts#L154)

Options for `channel.request()`.

## Properties

### timeout?

> `optional` **timeout**: `number`

Defined in: [packages/postal/src/channel.ts:160](https://github.com/postaljs/postal.js/blob/8f1628831582994e271d514bcf60125bd6a53fa1/packages/postal/src/channel.ts#L160)

Timeout in milliseconds. Defaults to 5000. Set to 0 to disable the timeout
entirely (the request will wait indefinitely until a handler responds or the
channel is disposed).
