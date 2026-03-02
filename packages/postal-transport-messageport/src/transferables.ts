/**
 * Transferable marking utilities for zero-copy ArrayBuffer transfer over MessagePort.
 *
 * `markTransferable` is the public API — callers annotate a payload before
 * publishing so the transport can pass a transfer list to `postMessage`.
 *
 * `consumeTransferables` is internal to the transport. It reads and deletes
 * the WeakMap entry in one step so the list is consumed exactly once.
 *
 * @module
 */

// Module-level WeakMap — shared across all transport instances in the same JS
// context. The payload object reference is the key, which is exactly what we
// want: each distinct payload object has its own transferable list.
const transferMap = new WeakMap<object, Transferable[]>();

/**
 * Marks a payload object with a list of Transferables to be zero-copy
 * transferred when the envelope is sent over a MessagePort.
 *
 * The payload itself is not modified — the association lives in a WeakMap.
 * If the payload is garbage collected before `postMessage` fires, the entry
 * is automatically cleaned up.
 *
 * Returns the payload so it can be used inline:
 * ```ts
 * channel.publish("frames.ready", markTransferable(payload, [buffer]));
 * ```
 *
 * @param payload - The envelope payload object (must be a non-null object)
 * @param transferables - Transferable objects whose ownership will be transferred
 * @returns The same payload reference (for inline chaining)
 */
export const markTransferable = <T extends object>(
    payload: T,
    transferables: Transferable[]
): T => {
    transferMap.set(payload, transferables);
    return payload;
};

/**
 * Reads and removes the transferable list for a payload.
 *
 * Consume-on-read ensures only the first transport in a broadcast loop gets
 * the transfer list. Subsequent transports find nothing and fall back to
 * structured clone — which is the correct behavior when peerCount > 1 anyway.
 *
 * Not exported — this is internal to the MessagePort transport send path.
 *
 * @param payload - The envelope payload (may be any value, including primitives)
 * @returns The transferable list, or an empty array if none was registered
 */
export const consumeTransferables = (payload: unknown): Transferable[] => {
    if (payload === null || typeof payload !== "object") {
        return [];
    }

    const list = transferMap.get(payload);

    if (list === undefined) {
        return [];
    }

    transferMap.delete(payload);
    return list;
};
