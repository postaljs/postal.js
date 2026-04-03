export default {};

import { ndjsonSerializer, createLineParser } from "./serialization";

describe("ndjsonSerializer", () => {
    describe("encode", () => {
        it("should produce a newline-terminated JSON string", () => {
            const result = ndjsonSerializer.encode({ type: "postal:uds-syn", version: 1 });
            expect(result).toBe('{"type":"postal:uds-syn","version":1}\n');
        });

        it("should handle strings", () => {
            expect(ndjsonSerializer.encode("hello")).toBe('"hello"\n');
        });

        it("should handle numbers", () => {
            expect(ndjsonSerializer.encode(88)).toBe("88\n");
        });

        it("should handle null", () => {
            expect(ndjsonSerializer.encode(null)).toBe("null\n");
        });
    });

    describe("decode", () => {
        it("should parse a JSON string", () => {
            expect(ndjsonSerializer.decode('{"speed":88}')).toEqual({ speed: 88 });
        });

        it("should throw on invalid JSON", () => {
            expect(() => ndjsonSerializer.decode("{broken")).toThrow();
        });
    });

    describe("round-trip", () => {
        it("should survive a round-trip with nested objects", () => {
            const original = { a: { b: { c: [1, 2, 3] } } };
            const encoded = ndjsonSerializer.encode(original);
            // Strip the trailing newline before decode (the transport splits on \n)
            const decoded = ndjsonSerializer.decode(encoded.trimEnd());
            expect(decoded).toEqual(original);
        });

        it("should survive embedded newlines in string values", () => {
            const original = { message: "line1\nline2\nline3" };
            const encoded = ndjsonSerializer.encode(original);
            // JSON.stringify escapes \n to \\n, so the encoded string has exactly one trailing newline
            expect(encoded.split("\n").length).toBe(2); // content + empty after trailing \n
            const decoded = ndjsonSerializer.decode(encoded.trimEnd());
            expect(decoded).toEqual(original);
        });

        it("should survive unicode characters", () => {
            const original = { emoji: "🔥⚡🚗", japanese: "未来" };
            const encoded = ndjsonSerializer.encode(original);
            const decoded = ndjsonSerializer.decode(encoded.trimEnd());
            expect(decoded).toEqual(original);
        });

        it("should survive empty objects", () => {
            const original = {};
            const encoded = ndjsonSerializer.encode(original);
            const decoded = ndjsonSerializer.decode(encoded.trimEnd());
            expect(decoded).toEqual(original);
        });

        it("should survive empty arrays", () => {
            const original: unknown[] = [];
            const encoded = ndjsonSerializer.encode(original);
            const decoded = ndjsonSerializer.decode(encoded.trimEnd());
            expect(decoded).toEqual(original);
        });

        it("should survive escaped newlines within string values", () => {
            // Explicitly verify the literal string "\\n" (escaped backslash-n) round-trips
            const original = { data: "line1\\nline2" };
            const encoded = ndjsonSerializer.encode(original);
            const decoded = ndjsonSerializer.decode(encoded.trimEnd());
            expect(decoded).toEqual(original);
        });

        it("should survive boolean and null values", () => {
            const original = { yes: true, no: false, nothing: null };
            const encoded = ndjsonSerializer.encode(original);
            const decoded = ndjsonSerializer.decode(encoded.trimEnd());
            expect(decoded).toEqual(original);
        });
    });
});

describe("createLineParser", () => {
    it("should parse a single complete line", () => {
        const received: unknown[] = [];
        const parser = createLineParser(msg => received.push(msg));
        parser('{"a":1}\n');
        expect(received).toEqual([{ a: 1 }]);
    });

    it("should buffer partial lines across multiple chunks", () => {
        const received: unknown[] = [];
        const parser = createLineParser(msg => received.push(msg));
        parser('{"a":');
        expect(received).toEqual([]);
        parser("1}\n");
        expect(received).toEqual([{ a: 1 }]);
    });

    it("should parse multiple lines in a single chunk", () => {
        const received: unknown[] = [];
        const parser = createLineParser(msg => received.push(msg));
        parser('{"a":1}\n{"b":2}\n');
        expect(received).toEqual([{ a: 1 }, { b: 2 }]);
    });

    it("should skip empty lines", () => {
        const received: unknown[] = [];
        const parser = createLineParser(msg => received.push(msg));
        parser('{"a":1}\n\n\n{"b":2}\n');
        expect(received).toEqual([{ a: 1 }, { b: 2 }]);
    });

    it("should silently drop malformed JSON lines", () => {
        const received: unknown[] = [];
        const parser = createLineParser(msg => received.push(msg));
        parser('not-json\n{"a":1}\n{broken}\n');
        expect(received).toEqual([{ a: 1 }]);
    });

    it("should handle Buffer input", () => {
        const received: unknown[] = [];
        const parser = createLineParser(msg => received.push(msg));
        parser(Buffer.from('{"a":1}\n', "utf-8"));
        expect(received).toEqual([{ a: 1 }]);
    });

    it("should handle a chunk with complete lines and a trailing partial", () => {
        const received: unknown[] = [];
        const parser = createLineParser(msg => received.push(msg));
        parser('{"a":1}\n{"b":2}\n{"c":');
        expect(received).toEqual([{ a: 1 }, { b: 2 }]);
        // Complete the partial
        parser("3}\n");
        expect(received).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
    });

    it("should accept a custom serializer", () => {
        const received: unknown[] = [];
        const customSerializer = {
            encode: (msg: unknown) => String(msg) + "\n",
            decode: (line: string) => ({ custom: line }),
        };
        const parser = createLineParser(msg => received.push(msg), customSerializer);
        parser("hello\n");
        expect(received).toEqual([{ custom: "hello" }]);
    });
});
