/**
 * Serialization abstraction for the UDS transport.
 *
 * The default NDJSON implementation is the only built-in serializer.
 * The interface exists so MessagePack (or similar) can be swapped in
 * without restructuring the transport.
 *
 * @module
 */

/** Encode/decode contract for wire serialization. */
export type Serializer = {
    /** Serialize a message to a newline-terminated string. */
    encode: (msg: unknown) => string;
    /** Deserialize a single line (without trailing newline) back to a value. */
    decode: (line: string) => unknown;
};

/**
 * NDJSON serializer — JSON.stringify + "\n" on encode, JSON.parse on decode.
 *
 * JSON's escaping rules guarantee no unescaped newlines in the output,
 * so "\n" is an unambiguous delimiter.
 */
export const ndjsonSerializer: Serializer = {
    encode: (msg: unknown): string => JSON.stringify(msg) + "\n",
    decode: (line: string): unknown => JSON.parse(line),
};

/**
 * Creates a stateful line-parser that buffers incoming chunks, splits on
 * newlines, decodes each complete line, and calls `onMessage` with the result.
 *
 * TCP delivers bytes, not messages — a single `data` event can contain
 * half a line, multiple lines, or 1.5 lines. The parser keeps the trailing
 * partial as its buffer for the next chunk.
 */
export const createLineParser = (
    onMessage: (parsed: unknown) => void,
    serializer: Serializer = ndjsonSerializer
): ((chunk: Buffer | string) => void) => {
    let buffer = "";
    return (chunk: Buffer | string): void => {
        buffer += typeof chunk === "string" ? chunk : chunk.toString("utf-8");
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines) {
            if (line.length === 0) {
                continue;
            }
            try {
                onMessage(serializer.decode(line));
            } catch {
                // Malformed line — skip
            }
        }
    };
};
