---
editUrl: false
next: false
prev: false
title: "TransportSendMeta"
---

> **TransportSendMeta** = `object`

Defined in: [packages/postal/src/transport.ts:27](https://github.com/postaljs/postal.js/blob/7ec96daac66b67b9cf6a6ba4a6805aa4639d3c51/packages/postal/src/transport.ts#L27)

Metadata passed to `Transport.send()` by the core.

Transports can use this to make send-time decisions that require context
the transport can't determine on its own. Currently carries `peerCount` so
a transport knows whether other transports are also receiving this envelope.

Transports that don't need this can safely ignore it — the parameter is optional.

## Properties

### peerCount

> **peerCount**: `number`

Defined in: [packages/postal/src/transport.ts:35](https://github.com/postaljs/postal.js/blob/7ec96daac66b67b9cf6a6ba4a6805aa4639d3c51/packages/postal/src/transport.ts#L35)

Number of transports that passed the filter for this envelope
(including the current transport).

A value of 1 means this transport is the sole recipient.
A value > 1 means multiple transports are receiving the same envelope.
