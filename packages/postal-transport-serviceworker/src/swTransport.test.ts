/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import { createSwSyn } from "./protocol";

// --- Module-level mock declarations ---

const mockAddTransport = jest.fn();
const mockCreateMessagePortTransport = jest.fn();

jest.mock("postal", () => ({
    addTransport: mockAddTransport,
}));

jest.mock("postal-transport-messageport", () => ({
    createMessagePortTransport: mockCreateMessagePortTransport,
}));

// --- Helpers ---

/**
 * Creates a fake MessagePort backed by an EventTarget so port.addEventListener("close", ...)
 * can be fired manually in tests via port.dispatchEvent(new Event("close")).
 */
const createFakePort = () => {
    const target = new EventTarget();

    const port = {
        addEventListener: target.addEventListener.bind(target),
        removeEventListener: target.removeEventListener.bind(target),
        dispatchEvent: target.dispatchEvent.bind(target),
        postMessage: jest.fn(),
        start: jest.fn(),
        close: jest.fn(),
    } as unknown as MessagePort & { dispatchEvent: (e: Event) => void };

    return port;
};

/**
 * Wraps data and ports into a minimal ExtendableMessageEvent shape.
 */
const makeSwEvent = (data: unknown, ports: MessagePort[] = []): ExtendableMessageEvent =>
    ({ data, ports, type: "message" }) as unknown as ExtendableMessageEvent;

/**
 * Sets up self.addEventListener / self.removeEventListener mocks and installs
 * them on global.self. Returns the captured message handler after listenForClients
 * is called so tests can fire synthetic SW messages directly.
 */
const setupSwGlobals = (selfAdd: jest.Mock, selfRemove: jest.Mock): void => {
    (global as any).self = {
        addEventListener: selfAdd,
        removeEventListener: selfRemove,
    };
};

describe("listenForClients", () => {
    let listenForClients: typeof import("./swTransport").listenForClients;
    let mockSelfAdd: jest.Mock, mockSelfRemove: jest.Mock;
    let mockTransport: { send: jest.Mock; subscribe: jest.Mock; dispose: jest.Mock };
    let mockRemoveTransport: jest.Mock;
    let capturedMessageHandler: ((e: ExtendableMessageEvent) => void) | null;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        mockSelfAdd = jest.fn();
        mockSelfRemove = jest.fn();
        mockRemoveTransport = jest.fn();
        mockTransport = { send: jest.fn(), subscribe: jest.fn(), dispose: jest.fn() };
        capturedMessageHandler = null;

        setupSwGlobals(mockSelfAdd, mockSelfRemove);

        // Capture the message handler that listenForClients registers on self
        mockSelfAdd.mockImplementation((event: string, handler: any) => {
            if (event === "message") {
                capturedMessageHandler = handler;
            }
        });
    });

    afterEach(() => {
        delete (global as any).self;
    });

    describe("when called", () => {
        beforeEach(async () => {
            ({ listenForClients } = await import("./swTransport"));
            listenForClients();
        });

        it("should register a message listener on the SW global self", () => {
            expect(mockSelfAdd).toHaveBeenCalledWith("message", expect.any(Function));
        });
    });

    describe("when a valid syn arrives with a transferred port", () => {
        let port: ReturnType<typeof createFakePort>;

        beforeEach(async () => {
            ({ listenForClients } = await import("./swTransport"));
            mockCreateMessagePortTransport.mockReturnValue(mockTransport);
            mockAddTransport.mockReturnValue(mockRemoveTransport);

            listenForClients();
            port = createFakePort();
            capturedMessageHandler!(makeSwEvent(createSwSyn(), [port]));
        });

        it("should send an ack through the transferred port", () => {
            expect(port.postMessage).toHaveBeenCalledTimes(1);
            expect(port.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: "postal:sw-ack" })
            );
        });

        it("should wrap the port in createMessagePortTransport", () => {
            expect(mockCreateMessagePortTransport).toHaveBeenCalledWith(port);
        });

        it("should register the transport with addTransport", () => {
            expect(mockAddTransport).toHaveBeenCalledWith(mockTransport, { filter: undefined });
        });
    });

    describe("when multiple clients connect", () => {
        let portA: ReturnType<typeof createFakePort>;
        let portB: ReturnType<typeof createFakePort>;

        beforeEach(async () => {
            ({ listenForClients } = await import("./swTransport"));
            mockCreateMessagePortTransport.mockReturnValue(mockTransport);
            mockAddTransport.mockReturnValue(mockRemoveTransport);

            listenForClients();
            portA = createFakePort();
            portB = createFakePort();

            capturedMessageHandler!(makeSwEvent(createSwSyn(), [portA]));
            capturedMessageHandler!(makeSwEvent(createSwSyn(), [portB]));
        });

        it("should create a transport for each client", () => {
            expect(mockCreateMessagePortTransport).toHaveBeenCalledTimes(2);
        });

        it("should register each transport with addTransport", () => {
            expect(mockAddTransport).toHaveBeenCalledTimes(2);
        });

        it("should send an ack to each client", () => {
            expect(portA.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: "postal:sw-ack" })
            );
            expect(portB.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: "postal:sw-ack" })
            );
        });
    });

    describe("when a client port closes", () => {
        let port: ReturnType<typeof createFakePort>;

        beforeEach(async () => {
            ({ listenForClients } = await import("./swTransport"));
            mockCreateMessagePortTransport.mockReturnValue(mockTransport);
            mockAddTransport.mockReturnValue(mockRemoveTransport);

            listenForClients();
            port = createFakePort();
            capturedMessageHandler!(makeSwEvent(createSwSyn(), [port]));

            // Simulate the port closing (tab unloads)
            port.dispatchEvent(new Event("close"));
        });

        it("should call removeTransport when the port closes", () => {
            expect(mockRemoveTransport).toHaveBeenCalledTimes(1);
        });
    });

    describe("when dispose is called", () => {
        let result: ReturnType<typeof listenForClients>;
        let mockRemoveA: jest.Mock, mockRemoveB: jest.Mock;

        beforeEach(async () => {
            ({ listenForClients } = await import("./swTransport"));

            mockRemoveA = jest.fn();
            mockRemoveB = jest.fn();
            mockCreateMessagePortTransport.mockReturnValue(mockTransport);
            mockAddTransport.mockReturnValueOnce(mockRemoveA).mockReturnValueOnce(mockRemoveB);

            result = listenForClients();
            capturedMessageHandler!(makeSwEvent(createSwSyn(), [createFakePort()]));
            capturedMessageHandler!(makeSwEvent(createSwSyn(), [createFakePort()]));

            result.dispose();
        });

        it("should remove the message listener from self", () => {
            expect(mockSelfRemove).toHaveBeenCalledWith("message", expect.any(Function));
        });

        it("should call removeTransport for all active connections", () => {
            expect(mockRemoveA).toHaveBeenCalledTimes(1);
            expect(mockRemoveB).toHaveBeenCalledTimes(1);
        });
    });

    describe("when dispose is called twice", () => {
        let result: ReturnType<typeof listenForClients>;

        beforeEach(async () => {
            ({ listenForClients } = await import("./swTransport"));
            result = listenForClients();
            result.dispose();
            result.dispose();
        });

        it("should remove the listener only once", () => {
            expect(mockSelfRemove).toHaveBeenCalledTimes(1);
        });
    });

    describe("when a non-postal message arrives on the SW global", () => {
        beforeEach(async () => {
            ({ listenForClients } = await import("./swTransport"));
            mockCreateMessagePortTransport.mockReturnValue(mockTransport);
            mockAddTransport.mockReturnValue(mockRemoveTransport);

            listenForClients();
            capturedMessageHandler!(makeSwEvent({ type: "random:noise" }, [createFakePort()]));
        });

        it("should not create a transport", () => {
            expect(mockCreateMessagePortTransport).not.toHaveBeenCalled();
        });

        it("should not register any transport", () => {
            expect(mockAddTransport).not.toHaveBeenCalled();
        });
    });

    describe("when a syn arrives with no transferred ports", () => {
        beforeEach(async () => {
            ({ listenForClients } = await import("./swTransport"));
            mockCreateMessagePortTransport.mockReturnValue(mockTransport);
            mockAddTransport.mockReturnValue(mockRemoveTransport);

            listenForClients();
            // Valid syn but no ports transferred — malformed handshake
            capturedMessageHandler!(makeSwEvent(createSwSyn(), []));
        });

        it("should not create a transport", () => {
            expect(mockCreateMessagePortTransport).not.toHaveBeenCalled();
        });
    });

    describe("when a message arrives after dispose", () => {
        beforeEach(async () => {
            ({ listenForClients } = await import("./swTransport"));
            mockCreateMessagePortTransport.mockReturnValue(mockTransport);
            mockAddTransport.mockReturnValue(mockRemoveTransport);

            const { dispose } = listenForClients();
            dispose();

            // mockSelfRemove is a no-op so handler still fires — disposed flag must block it
            capturedMessageHandler!(makeSwEvent(createSwSyn(), [createFakePort()]));
        });

        it("should not register any new transports after dispose", () => {
            expect(mockAddTransport).not.toHaveBeenCalled();
        });
    });

    describe("when a filter option is provided", () => {
        beforeEach(async () => {
            ({ listenForClients } = await import("./swTransport"));
            mockCreateMessagePortTransport.mockReturnValue(mockTransport);
            mockAddTransport.mockReturnValue(mockRemoveTransport);

            listenForClients({ filter: { channels: ["notifications"] } });
            capturedMessageHandler!(makeSwEvent(createSwSyn(), [createFakePort()]));
        });

        it("should pass the filter to addTransport", () => {
            expect(mockAddTransport).toHaveBeenCalledWith(mockTransport, {
                filter: { channels: ["notifications"] },
            });
        });
    });

    describe("when dispose is called with active connections", () => {
        let portA: ReturnType<typeof createFakePort>;
        let portB: ReturnType<typeof createFakePort>;

        beforeEach(async () => {
            ({ listenForClients } = await import("./swTransport"));
            mockCreateMessagePortTransport.mockReturnValue(mockTransport);
            mockAddTransport.mockReturnValue(mockRemoveTransport);

            const { dispose } = listenForClients();
            portA = createFakePort();
            portB = createFakePort();

            capturedMessageHandler!(makeSwEvent(createSwSyn(), [portA]));
            capturedMessageHandler!(makeSwEvent(createSwSyn(), [portB]));

            dispose();
        });

        it("should call port.close() on each tracked port", () => {
            expect(portA.close).toHaveBeenCalledTimes(1);
            expect(portB.close).toHaveBeenCalledTimes(1);
        });
    });

    describe("when a port close event fires after dispose has already removed the connection", () => {
        let port: ReturnType<typeof createFakePort>;
        let mockRemoveForPort: jest.Mock;

        beforeEach(async () => {
            ({ listenForClients } = await import("./swTransport"));
            mockRemoveForPort = jest.fn();
            mockCreateMessagePortTransport.mockReturnValue(mockTransport);
            mockAddTransport.mockReturnValue(mockRemoveForPort);

            const { dispose } = listenForClients();
            port = createFakePort();
            capturedMessageHandler!(makeSwEvent(createSwSyn(), [port]));

            // dispose() removes all connections from the Map before the port fires close
            dispose();

            // Now the stale close event fires — connections.get(port) returns undefined
            port.dispatchEvent(new Event("close"));
        });

        it("should not call removeTransport a second time", () => {
            expect(mockRemoveForPort).toHaveBeenCalledTimes(1);
        });
    });
});
