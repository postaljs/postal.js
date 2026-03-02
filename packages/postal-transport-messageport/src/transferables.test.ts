/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import { markTransferable, consumeTransferables } from "./transferables";

describe("transferables", () => {
    describe("markTransferable", () => {
        describe("when called with a payload and a transfer list", () => {
            let payload: { data: string };
            let buffer: ArrayBuffer;
            let result: { data: string };

            beforeEach(() => {
                payload = { data: "FLUX-CAPACITOR-READINGS" };
                buffer = new ArrayBuffer(8);
                result = markTransferable(payload, [buffer]);
            });

            it("should return the same payload reference", () => {
                expect(result).toBe(payload);
            });
        });
    });

    describe("consumeTransferables", () => {
        describe("when called with a marked payload", () => {
            let payload: { frame: string };
            let buffer: ArrayBuffer;
            let consumed: Transferable[];

            beforeEach(() => {
                payload = { frame: "WEBCAM-FRAME-001" };
                buffer = new ArrayBuffer(1024);
                markTransferable(payload, [buffer]);
                consumed = consumeTransferables(payload);
            });

            it("should return the registered transferable list", () => {
                expect(consumed).toEqual([buffer]);
            });
        });

        describe("when called a second time with the same payload", () => {
            let payload: { frame: string };
            let secondResult: Transferable[];

            beforeEach(() => {
                payload = { frame: "WEBCAM-FRAME-002" };
                const buffer = new ArrayBuffer(512);
                markTransferable(payload, [buffer]);
                consumeTransferables(payload);
                secondResult = consumeTransferables(payload);
            });

            it("should return an empty array — entry was consumed on first call", () => {
                expect(secondResult).toEqual([]);
            });
        });

        describe("when called with an unmarked payload", () => {
            let result: Transferable[];

            beforeEach(() => {
                result = consumeTransferables({ not: "marked" });
            });

            it("should return an empty array", () => {
                expect(result).toEqual([]);
            });
        });

        describe("when called with null", () => {
            let result: Transferable[];

            beforeEach(() => {
                result = consumeTransferables(null);
            });

            it("should return an empty array", () => {
                expect(result).toEqual([]);
            });
        });

        describe("when called with undefined", () => {
            let result: Transferable[];

            beforeEach(() => {
                result = consumeTransferables(undefined);
            });

            it("should return an empty array", () => {
                expect(result).toEqual([]);
            });
        });

        describe("when called with a primitive payload", () => {
            let result: Transferable[];

            beforeEach(() => {
                result = consumeTransferables(42 as any);
            });

            it("should return an empty array", () => {
                expect(result).toEqual([]);
            });
        });

        describe("when multiple payloads are independently marked", () => {
            let bufferA: ArrayBuffer, bufferB: ArrayBuffer;
            let payloadA: object, payloadB: object;
            let resultA: Transferable[], resultB: Transferable[];

            beforeEach(() => {
                bufferA = new ArrayBuffer(256);
                bufferB = new ArrayBuffer(512);
                payloadA = { id: "FRAME-A" };
                payloadB = { id: "FRAME-B" };
                markTransferable(payloadA, [bufferA]);
                markTransferable(payloadB, [bufferB]);
                resultA = consumeTransferables(payloadA);
                resultB = consumeTransferables(payloadB);
            });

            it("should return the correct list for payloadA", () => {
                expect(resultA).toEqual([bufferA]);
            });

            it("should return the correct list for payloadB", () => {
                expect(resultB).toEqual([bufferB]);
            });
        });

        describe("when called with a payload marked with an empty transfer list", () => {
            let result: Transferable[];

            beforeEach(() => {
                const payload = { frame: "EMPTY-TRANSFER-FRAME" };
                markTransferable(payload, []);
                result = consumeTransferables(payload);
            });

            it("should return an empty array — the entry is found but the list is empty", () => {
                expect(result).toEqual([]);
            });
        });
    });

    describe("markTransferable", () => {
        describe("when called twice on the same payload", () => {
            let payload: { id: string };
            let bufferFirst: ArrayBuffer, bufferSecond: ArrayBuffer;
            let consumed: Transferable[];

            beforeEach(() => {
                payload = { id: "OVERWRITE-TARGET" };
                bufferFirst = new ArrayBuffer(8);
                bufferSecond = new ArrayBuffer(32);
                markTransferable(payload, [bufferFirst]);
                markTransferable(payload, [bufferSecond]);
                consumed = consumeTransferables(payload);
            });

            it("should overwrite the previous transfer list with the new one", () => {
                expect(consumed).toEqual([bufferSecond]);
            });

            it("should not include the first buffer in the consumed list", () => {
                expect(consumed).not.toContain(bufferFirst);
            });
        });
    });
});
