/**
 * GIF encoding worker.
 *
 * This worker is the other side of the postal MessagePort transport bridge.
 * It receives encoding requests from the main thread via postal's request/handle
 * RPC pattern, encodes the frames into an animated GIF using gifenc, and publishes
 * per-frame progress events back while the encoding runs.
 *
 * The key insight: from this side of the bridge, the code looks exactly like
 * any other postal usage — channel.handle(), channel.publish(). The transport
 * layer handles all the postMessage plumbing invisibly.
 */

import { getChannel, addTransport } from "postal";
import { connectToHost } from "postal-transport-messageport";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import type { Envelope } from "postal";

/** Shape of the encoding request payload from the main thread. */
type EncodeRequest = {
    /** Slot index in the grid — used to correlate progress events. */
    index: number;
    /** Raw RGBA ArrayBuffers, one per frame (already transferred zero-copy). */
    buffers: ArrayBuffer[];
    width: number;
    height: number;
    /** Frame delay in milliseconds — gifenc handles the ms-to-centisecond conversion. */
    delay: number;
};

/** Shape of the encoding response returned to the main thread via RPC. */
type EncodeResponse = {
    /** Raw bytes of the completed animated GIF. */
    gif: Uint8Array;
};

// Connect to the main thread's postal instance via the MessagePort transport.
// connectToHost() waits for the SYN message that connectToWorker() sends,
// completes the handshake, and resolves with a ready Transport.
const transport = await connectToHost();
addTransport(transport);

// Use the same channel name as the main thread — postal routes messages to
// the correct channel on whichever side registered a handler for them.
const channel = getChannel("gif-stitch");

channel.handle(
    "encode.start",
    async (envelope: Envelope<EncodeRequest>): Promise<EncodeResponse> => {
        const { index, buffers, width, height, delay } = envelope.payload;
        const encoder = GIFEncoder();

        for (let i = 0; i < buffers.length; i++) {
            // Reconstruct typed array from the transferred ArrayBuffer.
            // The buffer ownership moved to this worker via zero-copy transfer,
            // so we're the sole owner — safe to read without copying.
            // Uint8Array is intentional here: the original ImageData.data was Uint8ClampedArray,
            // but RGBA bytes are identical under either typed array view, and gifenc accepts both.
            const rgba = new Uint8Array(buffers[i]);

            // gifenc pipeline: quantize → palette → indexed pixels → writeFrame.
            // 256 colors is the GIF maximum. Webcam footage won't be gallery-quality
            // at 256 colors — but the lo-fi animated GIF aesthetic is the point.
            const palette = quantize(rgba, 256);
            const index8 = applyPalette(rgba, palette);

            encoder.writeFrame(index8, width, height, {
                palette,
                // gifenc accepts delay in ms and converts to centiseconds internally
                delay,
                repeat: 0,
            });

            // Publish progress on the shared channel. The main thread subscribed
            // before issuing the request, so it receives these mid-RPC as
            // fire-and-forget updates — two postal patterns running in parallel.
            const percent = Math.round(((i + 1) / buffers.length) * 100);
            channel.publish("encode.progress", { index, percent });
        }

        encoder.finish();

        return { gif: encoder.bytes() };
    }
);
