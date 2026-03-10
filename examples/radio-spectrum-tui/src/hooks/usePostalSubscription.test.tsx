/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

// usePostalSubscription.test.tsx — happy-path tests for the postal subscription hook.
//
// Tests the hook's behavior by directly verifying the postal subscribe/unsubscribe
// lifecycle. We mock postal and React hooks to avoid the ESM-in-Jest problem
// that occurs when ink-testing-library tries to load ink (pure ESM + import.meta).
//
// The throttle is tested by advancing fake timers and verifying the setState
// (setTick) is called only when a new message arrived.

jest.mock("postal");
jest.mock("react");

const mockUnsubscribe = jest.fn();
const mockSubscribe = jest.fn();
const mockGetChannel = jest.fn();
const mockUseState = jest.fn();
const mockUseRef = jest.fn();
const mockUseEffect = jest.fn();

jest.mock("postal", () => ({
    getChannel: mockGetChannel,
}));

jest.mock("react", () => ({
    useEffect: mockUseEffect,
    useRef: mockUseRef,
    useState: mockUseState,
}));

// Refs: latestRef, pendingRef, throttleTimerRef, prevResetKeyRef
const latestRefObj = { current: null as any };
const pendingRefObj = { current: false };
const throttleTimerRefObj = { current: null as any };
const prevResetKeyRefObj = { current: undefined as unknown };

let capturedEffectCallback: (() => (() => void) | void) | null = null;
let capturedPostalCallback: ((envelope: any) => void) | null = null;
let capturedCleanup: (() => void) | null = null;

describe("usePostalSubscription", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        jest.useFakeTimers();

        capturedEffectCallback = null;
        capturedPostalCallback = null;
        capturedCleanup = null;
        latestRefObj.current = null;
        pendingRefObj.current = false;
        throttleTimerRefObj.current = null;
        prevResetKeyRefObj.current = undefined;

        let refCallCount = 0;
        mockUseRef.mockImplementation(() => {
            const refs = [latestRefObj, pendingRefObj, throttleTimerRefObj, prevResetKeyRefObj];
            return refs[refCallCount++] ?? { current: null };
        });

        mockUseState.mockReturnValue([0, jest.fn()]);

        mockUseEffect.mockImplementation((cb: () => (() => void) | void) => {
            capturedEffectCallback = cb;
        });

        // postal's subscribe() returns an unsubscribe function directly (not an object).
        mockSubscribe.mockImplementation((_topic: string, cb: (envelope: any) => void) => {
            capturedPostalCallback = cb;
            return mockUnsubscribe;
        });

        mockGetChannel.mockReturnValue({ subscribe: mockSubscribe });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const runEffect = (): void => {
        if (capturedEffectCallback) {
            const cleanup = capturedEffectCallback();
            if (typeof cleanup === "function") {
                capturedCleanup = cleanup;
            }
        }
    };

    describe("when the hook is initialized", () => {
        beforeEach(async () => {
            const { usePostalSubscription } = await import("./usePostalSubscription.js");
            usePostalSubscription("POSTAL_FM", "radio.viz.spectrum");
            runEffect();
        });

        it("should get the radio channel", () => {
            expect(mockGetChannel).toHaveBeenCalledTimes(1);
            expect(mockGetChannel).toHaveBeenCalledWith("POSTAL_FM");
        });

        it("should subscribe to the specified topic", () => {
            expect(mockSubscribe).toHaveBeenCalledTimes(1);
            expect(mockSubscribe).toHaveBeenCalledWith("radio.viz.spectrum", expect.any(Function));
        });

        it("should start a throttle interval timer", () => {
            expect(throttleTimerRefObj.current).not.toBeNull();
        });
    });

    describe("when a message arrives on the subscribed topic", () => {
        beforeEach(async () => {
            const { usePostalSubscription } = await import("./usePostalSubscription.js");
            usePostalSubscription("POSTAL_FM", "radio.viz.spectrum");
            runEffect();

            capturedPostalCallback!({ payload: { bins: [0.5, 0.8, 0.3] } });
        });

        it("should store the payload in the latest ref", () => {
            expect(latestRefObj.current).toEqual({ bins: [0.5, 0.8, 0.3] });
        });

        it("should mark the pending flag as true", () => {
            expect(pendingRefObj.current).toBe(true);
        });
    });

    describe("when the throttle tick fires after a message has arrived", () => {
        let setTickMock: jest.Mock;

        beforeEach(async () => {
            setTickMock = jest.fn();
            mockUseState.mockReturnValue([0, setTickMock]);

            const { usePostalSubscription } = await import("./usePostalSubscription.js");
            usePostalSubscription("POSTAL_FM", "radio.viz.spectrum");
            runEffect();

            capturedPostalCallback!({ payload: "GROOVE_SALAD_PAYLOAD" });
            jest.advanceTimersByTime(40);
        });

        it("should call the state setter to trigger a re-render", () => {
            expect(setTickMock).toHaveBeenCalledTimes(1);
        });

        it("should clear the pending flag", () => {
            expect(pendingRefObj.current).toBe(false);
        });
    });

    describe("when the throttle tick fires with no pending messages", () => {
        let setTickMock: jest.Mock;

        beforeEach(async () => {
            setTickMock = jest.fn();
            mockUseState.mockReturnValue([0, setTickMock]);

            const { usePostalSubscription } = await import("./usePostalSubscription.js");
            usePostalSubscription("POSTAL_FM", "radio.viz.spectrum");
            runEffect();

            jest.advanceTimersByTime(40);
        });

        it("should not call the state setter (no unnecessary re-renders)", () => {
            expect(setTickMock).not.toHaveBeenCalled();
        });
    });

    describe("when unmounted (cleanup)", () => {
        beforeEach(async () => {
            const { usePostalSubscription } = await import("./usePostalSubscription.js");
            usePostalSubscription("POSTAL_FM", "radio.viz.spectrum");
            runEffect();
            capturedCleanup!();
        });

        it("should unsubscribe from postal", () => {
            expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
        });

        it("should clear the throttle interval", () => {
            expect(throttleTimerRefObj.current).toBeNull();
        });
    });
});
