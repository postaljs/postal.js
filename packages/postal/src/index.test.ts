export default {};

import {
    getChannel,
    resetChannels,
    PostalTimeoutError,
    PostalRpcError,
    addTransport,
    resetTransports,
    addWiretap,
    resetWiretaps,
} from "./index";

describe("barrel exports", () => {
    afterEach(() => {
        resetChannels();
    });

    it("should export getChannel", () => {
        expect(typeof getChannel).toBe("function");
    });

    it("should export resetChannels", () => {
        expect(typeof resetChannels).toBe("function");
    });

    it("should export PostalTimeoutError", () => {
        const err = new PostalTimeoutError("ch", "topic", 5000);
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(PostalTimeoutError);
    });

    it("should export PostalRpcError", () => {
        const err = new PostalRpcError("boom");
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(PostalRpcError);
    });

    it("should export addTransport", () => {
        expect(typeof addTransport).toBe("function");
    });

    it("should export resetTransports", () => {
        expect(typeof resetTransports).toBe("function");
    });

    it("should export addWiretap", () => {
        expect(typeof addWiretap).toBe("function");
    });

    it("should export resetWiretaps", () => {
        expect(typeof resetWiretaps).toBe("function");
    });

    it("should produce a working channel through the barrel", () => {
        const channel = getChannel("test");
        const received: unknown[] = [];
        channel.subscribe("greeting", envelope => {
            received.push(envelope.payload);
        });
        channel.publish("greeting", "hello");
        expect(received).toEqual(["hello"]);
    });
});
