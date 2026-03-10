/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import { PostalSwHandshakeTimeoutError, PostalSwNotActiveError } from "./errors";
import { createSwAck } from "./protocol";

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
 * Builds a mock ServiceWorkerRegistration with a controllable active worker.
 */
const makeMockRegistration = (
    activeOverride?: Partial<ServiceWorker> | null
): ServiceWorkerRegistration => {
    const active =
        activeOverride === null
            ? null
            : ({ postMessage: jest.fn(), ...activeOverride } as unknown as ServiceWorker);

    return { active } as unknown as ServiceWorkerRegistration;
};

/**
 * Creates a fake MessagePort pair backed by EventTargets so messages actually
 * flow between port1 and port2. Used to simulate the real MessageChannel behavior.
 */
const createFakeMessageChannel = () => {
    const port1EventTarget = new EventTarget();
    const port2EventTarget = new EventTarget();

    const makePort = (localTarget: EventTarget, remoteTarget: EventTarget): MessagePort => {
        return {
            addEventListener: localTarget.addEventListener.bind(localTarget),
            removeEventListener: localTarget.removeEventListener.bind(localTarget),
            dispatchEvent: localTarget.dispatchEvent.bind(localTarget),
            postMessage: jest.fn((data: unknown) => {
                remoteTarget.dispatchEvent(new MessageEvent("message", { data }));
            }),
            start: jest.fn(),
            close: jest.fn(),
        } as unknown as MessagePort;
    };

    const port1 = makePort(port1EventTarget, port2EventTarget);
    const port2 = makePort(port2EventTarget, port1EventTarget);

    return { port1, port2 };
};

describe("connectToServiceWorker", () => {
    let connectToServiceWorker: typeof import("./clientTransport").connectToServiceWorker;
    let mockRemoveTransport: jest.Mock;
    let mockTransport: { send: jest.Mock; subscribe: jest.Mock; dispose: jest.Mock };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        mockRemoveTransport = jest.fn();
        mockTransport = {
            send: jest.fn(),
            subscribe: jest.fn(),
            dispose: jest.fn(),
        };
    });

    describe("when registration.active is null", () => {
        let rejectedError: unknown;

        beforeEach(async () => {
            ({ connectToServiceWorker } = await import("./clientTransport"));
            const registration = makeMockRegistration(null);

            try {
                await connectToServiceWorker(registration);
            } catch (err) {
                rejectedError = err;
            }
        });

        it("should reject with PostalSwNotActiveError", () => {
            expect(rejectedError).toBeInstanceOf(Error);
            expect((rejectedError as Error).name).toBe("PostalSwNotActiveError");
        });

        it("should include a message about registration.active", () => {
            expect((rejectedError as Error).message).toMatch(/active/i);
        });
    });

    describe("when the SW acknowledges the handshake", () => {
        let result: () => void;
        let capturedPort2: MessagePort;
        let registration: ServiceWorkerRegistration;

        beforeEach(async () => {
            ({ connectToServiceWorker } = await import("./clientTransport"));

            mockCreateMessagePortTransport.mockReturnValue(mockTransport);
            mockAddTransport.mockReturnValue(mockRemoveTransport);

            registration = makeMockRegistration();
            const { port1, port2 } = createFakeMessageChannel();

            // Intercept MessageChannel construction so we control the ports
            jest.spyOn(globalThis, "MessageChannel" as any).mockImplementation(() => ({
                port1,
                port2,
            }));

            // Capture port2 that the SW would receive so we can send the ack back
            (registration.active!.postMessage as jest.Mock).mockImplementation(
                (_data: unknown, transfer: MessagePort[]) => {
                    capturedPort2 = transfer[0];
                    // SW sends ack back through port2 (which flows to port1 via the fake channel)
                    capturedPort2.postMessage(createSwAck());
                }
            );

            result = await connectToServiceWorker(registration, { timeout: 1000 });
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("should resolve with the removeTransport function", () => {
            expect(result).toBe(mockRemoveTransport);
        });

        it("should call createMessagePortTransport with the port", () => {
            expect(mockCreateMessagePortTransport).toHaveBeenCalledTimes(1);
            expect(mockCreateMessagePortTransport).toHaveBeenCalledWith(
                expect.objectContaining({ postMessage: expect.any(Function) })
            );
        });

        it("should call addTransport with the created transport", () => {
            expect(mockAddTransport).toHaveBeenCalledTimes(1);
            expect(mockAddTransport).toHaveBeenCalledWith(mockTransport);
        });

        it("should send a sw-syn to registration.active with port2 transferred", () => {
            expect(registration.active!.postMessage).toHaveBeenCalledTimes(1);
            const [data, transfer] = (registration.active!.postMessage as jest.Mock).mock.calls[0];
            expect(data).toEqual(expect.objectContaining({ type: "postal:sw-syn" }));
            expect(transfer).toHaveLength(1);
        });
    });

    describe("when the SW does not respond within the timeout", () => {
        let rejectedError: unknown;

        beforeEach(async () => {
            jest.useFakeTimers();
            ({ connectToServiceWorker } = await import("./clientTransport"));

            const registration = makeMockRegistration();
            // postMessage is a no-op — SW never sends ack
            (registration.active!.postMessage as jest.Mock).mockImplementation(() => {});

            const promise = connectToServiceWorker(registration, { timeout: 500 }).catch(err => {
                rejectedError = err;
            });

            jest.advanceTimersByTime(501);
            await promise;
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("should reject with PostalSwHandshakeTimeoutError", () => {
            expect(rejectedError).toBeInstanceOf(Error);
            expect((rejectedError as Error).name).toBe("PostalSwHandshakeTimeoutError");
        });

        it("should include the timeout value on the error", () => {
            expect((rejectedError as PostalSwHandshakeTimeoutError).timeout).toBe(500);
        });
    });

    describe("when non-ack messages arrive on the port before the real ack", () => {
        let result: () => void;

        beforeEach(async () => {
            ({ connectToServiceWorker } = await import("./clientTransport"));

            mockCreateMessagePortTransport.mockReturnValue(mockTransport);
            mockAddTransport.mockReturnValue(mockRemoveTransport);

            const registration = makeMockRegistration();
            const { port1, port2 } = createFakeMessageChannel();

            jest.spyOn(globalThis, "MessageChannel" as any).mockImplementation(() => ({
                port1,
                port2,
            }));

            (registration.active!.postMessage as jest.Mock).mockImplementation(
                (_data: unknown, transfer: MessagePort[]) => {
                    const receivedPort = transfer[0];
                    // First send noise, then the real ack
                    receivedPort.postMessage({ type: "random:noise" });
                    receivedPort.postMessage({ type: "postal:envelope", envelope: {} });
                    receivedPort.postMessage(createSwAck());
                }
            );

            result = await connectToServiceWorker(registration, { timeout: 1000 });
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("should ignore non-ack messages and resolve on the real ack", () => {
            expect(result).toBe(mockRemoveTransport);
        });
    });

    describe("when onDisconnect is provided and controllerchange fires", () => {
        let onDisconnect: jest.Mock;
        let controllerChangeHandler: EventListener;

        beforeEach(async () => {
            ({ connectToServiceWorker } = await import("./clientTransport"));

            onDisconnect = jest.fn();
            mockCreateMessagePortTransport.mockReturnValue(mockTransport);
            mockAddTransport.mockReturnValue(mockRemoveTransport);

            const mockSwAddEventListener = jest.fn();
            const mockSwRemoveEventListener = jest.fn();

            // Capture the controllerchange listener
            mockSwAddEventListener.mockImplementation((event: string, handler: EventListener) => {
                if (event === "controllerchange") {
                    controllerChangeHandler = handler;
                }
            });

            (global as any).navigator = {
                serviceWorker: {
                    addEventListener: mockSwAddEventListener,
                    removeEventListener: mockSwRemoveEventListener,
                },
            };

            const registration = makeMockRegistration();
            const { port1, port2 } = createFakeMessageChannel();

            jest.spyOn(globalThis, "MessageChannel" as any).mockImplementation(() => ({
                port1,
                port2,
            }));

            (registration.active!.postMessage as jest.Mock).mockImplementation(
                (_data: unknown, transfer: MessagePort[]) => {
                    transfer[0].postMessage(createSwAck());
                }
            );

            await connectToServiceWorker(registration, { timeout: 1000, onDisconnect });

            // Fire the controllerchange event
            controllerChangeHandler!(new Event("controllerchange"));
        });

        afterEach(() => {
            jest.restoreAllMocks();
            delete (global as any).navigator;
        });

        it("should call onDisconnect when controllerchange fires", () => {
            expect(onDisconnect).toHaveBeenCalledTimes(1);
        });
    });

    describe("when onDisconnect is not provided", () => {
        let result: () => void;

        beforeEach(async () => {
            ({ connectToServiceWorker } = await import("./clientTransport"));

            mockCreateMessagePortTransport.mockReturnValue(mockTransport);
            mockAddTransport.mockReturnValue(mockRemoveTransport);

            const registration = makeMockRegistration();
            const { port1, port2 } = createFakeMessageChannel();

            jest.spyOn(globalThis, "MessageChannel" as any).mockImplementation(() => ({
                port1,
                port2,
            }));

            (registration.active!.postMessage as jest.Mock).mockImplementation(
                (_data: unknown, transfer: MessagePort[]) => {
                    transfer[0].postMessage(createSwAck());
                }
            );

            result = await connectToServiceWorker(registration, { timeout: 1000 });
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("should resolve with the removeTransport function", () => {
            expect(result).toBe(mockRemoveTransport);
        });
    });

    describe("when the returned removeTransport is called", () => {
        beforeEach(async () => {
            ({ connectToServiceWorker } = await import("./clientTransport"));

            mockCreateMessagePortTransport.mockReturnValue(mockTransport);
            mockAddTransport.mockReturnValue(mockRemoveTransport);

            const registration = makeMockRegistration();
            const { port1, port2 } = createFakeMessageChannel();

            jest.spyOn(globalThis, "MessageChannel" as any).mockImplementation(() => ({
                port1,
                port2,
            }));

            (registration.active!.postMessage as jest.Mock).mockImplementation(
                (_data: unknown, transfer: MessagePort[]) => {
                    transfer[0].postMessage(createSwAck());
                }
            );

            const removeTransport = await connectToServiceWorker(registration, { timeout: 1000 });
            removeTransport();
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("should call the removeTransport from addTransport", () => {
            expect(mockRemoveTransport).toHaveBeenCalledTimes(1);
        });
    });

    describe("when the returned removeTransport is called before controllerchange fires", () => {
        let mockSwRemoveEventListener: jest.Mock;

        beforeEach(async () => {
            ({ connectToServiceWorker } = await import("./clientTransport"));

            mockCreateMessagePortTransport.mockReturnValue(mockTransport);
            mockAddTransport.mockReturnValue(mockRemoveTransport);

            const mockSwAddEventListener = jest.fn();
            mockSwRemoveEventListener = jest.fn();

            (global as any).navigator = {
                serviceWorker: {
                    addEventListener: mockSwAddEventListener,
                    removeEventListener: mockSwRemoveEventListener,
                },
            };

            const registration = makeMockRegistration();
            const { port1, port2 } = createFakeMessageChannel();

            jest.spyOn(globalThis, "MessageChannel" as any).mockImplementation(() => ({
                port1,
                port2,
            }));

            (registration.active!.postMessage as jest.Mock).mockImplementation(
                (_data: unknown, transfer: MessagePort[]) => {
                    transfer[0].postMessage(createSwAck());
                }
            );

            // Connect with onDisconnect — this registers the controllerchange listener
            const removeTransport = await connectToServiceWorker(registration, {
                timeout: 1000,
                onDisconnect: jest.fn(),
            });

            // Call removeTransport before controllerchange ever fires
            removeTransport();
        });

        afterEach(() => {
            jest.restoreAllMocks();
            delete (global as any).navigator;
        });

        it("should remove the controllerchange listener from navigator.serviceWorker", () => {
            expect(mockSwRemoveEventListener).toHaveBeenCalledWith(
                "controllerchange",
                expect.any(Function)
            );
        });

        it("should also call the removeTransport from addTransport", () => {
            expect(mockRemoveTransport).toHaveBeenCalledTimes(1);
        });
    });

    describe("PostalSwHandshakeTimeoutError identity", () => {
        let error: PostalSwHandshakeTimeoutError;

        beforeEach(() => {
            error = new PostalSwHandshakeTimeoutError(3000);
        });

        it("should have name PostalSwHandshakeTimeoutError", () => {
            expect(error.name).toBe("PostalSwHandshakeTimeoutError");
        });

        it("should be an instance of Error", () => {
            expect(error).toBeInstanceOf(Error);
        });

        it("should expose the timeout value", () => {
            expect(error.timeout).toBe(3000);
        });
    });

    describe("PostalSwNotActiveError identity", () => {
        let error: PostalSwNotActiveError;

        beforeEach(() => {
            error = new PostalSwNotActiveError();
        });

        it("should have name PostalSwNotActiveError", () => {
            expect(error.name).toBe("PostalSwNotActiveError");
        });

        it("should be an instance of Error", () => {
            expect(error).toBeInstanceOf(Error);
        });
    });
});
