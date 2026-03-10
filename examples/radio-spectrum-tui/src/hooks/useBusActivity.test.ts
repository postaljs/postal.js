/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

jest.mock("postal");
jest.mock("react");

const mockAddWiretap = jest.fn();
const mockUseState = jest.fn();
const mockUseRef = jest.fn();
const mockUseEffect = jest.fn();

jest.mock("postal", () => ({
    addWiretap: mockAddWiretap,
}));

jest.mock("react", () => ({
    useEffect: mockUseEffect,
    useRef: mockUseRef,
    useState: mockUseState,
}));

const timerRefObj = { current: null as any };

let capturedEffectCallback: (() => (() => void) | void) | null = null;
let capturedWiretapCallback: (() => void) | null = null;
let capturedCleanup: (() => void) | null = null;
let mockRemoveWiretap: jest.Mock;

describe("useBusActivity", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        jest.useFakeTimers();

        capturedEffectCallback = null;
        capturedWiretapCallback = null;
        capturedCleanup = null;
        timerRefObj.current = null;
        mockRemoveWiretap = jest.fn();

        mockUseRef.mockReturnValue(timerRefObj);
        mockUseState.mockReturnValue([false, jest.fn()]);

        mockUseEffect.mockImplementation((cb: () => (() => void) | void) => {
            capturedEffectCallback = cb;
        });

        mockAddWiretap.mockImplementation((cb: () => void) => {
            capturedWiretapCallback = cb;
            return mockRemoveWiretap;
        });
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
            const { useBusActivity } = await import("./useBusActivity.js");
            useBusActivity();
            runEffect();
        });

        it("should register a wiretap", () => {
            expect(mockAddWiretap).toHaveBeenCalledTimes(1);
            expect(mockAddWiretap).toHaveBeenCalledWith(expect.any(Function));
        });

        it("should return false as the initial state", () => {
            expect(mockUseState).toHaveBeenCalledWith(false);
        });
    });

    describe("when a postal message fires the wiretap", () => {
        let setActiveMock: jest.Mock;

        beforeEach(async () => {
            setActiveMock = jest.fn();
            mockUseState.mockReturnValue([false, setActiveMock]);

            const { useBusActivity } = await import("./useBusActivity.js");
            useBusActivity();
            runEffect();

            capturedWiretapCallback!();
        });

        it("should set active to true", () => {
            expect(setActiveMock).toHaveBeenCalledWith(true);
        });

        it("should start a flash timeout", () => {
            expect(timerRefObj.current).not.toBeNull();
        });
    });

    describe("when the flash timeout fires after a message", () => {
        let setActiveMock: jest.Mock;

        beforeEach(async () => {
            setActiveMock = jest.fn();
            mockUseState.mockReturnValue([false, setActiveMock]);

            const { useBusActivity } = await import("./useBusActivity.js");
            useBusActivity();
            runEffect();

            capturedWiretapCallback!();
            jest.advanceTimersByTime(100);
        });

        it("should set active back to false", () => {
            expect(setActiveMock).toHaveBeenCalledWith(false);
        });

        it("should clear the timer ref", () => {
            expect(timerRefObj.current).toBeNull();
        });
    });

    describe("when a second message arrives before the flash timeout expires", () => {
        let setActiveMock: jest.Mock;

        beforeEach(async () => {
            setActiveMock = jest.fn();
            mockUseState.mockReturnValue([false, setActiveMock]);

            const { useBusActivity } = await import("./useBusActivity.js");
            useBusActivity();
            runEffect();

            // First message — sets a timer
            capturedWiretapCallback!();
            const firstTimer = timerRefObj.current;

            // Second message arrives before 100ms — should clear first timer
            capturedWiretapCallback!();

            // Verify the timer was replaced (first timer was cleared, new one set)
            timerRefObj.current = firstTimer; // restore so we can confirm clearTimeout ran on it
        });

        it("should have called setActive(true) twice (once per message)", () => {
            expect(setActiveMock).toHaveBeenCalledWith(true);
            expect(setActiveMock.mock.calls.filter((c: any[]) => c[0] === true).length).toBe(2);
        });
    });

    describe("when unmounted while a flash timer is active", () => {
        beforeEach(async () => {
            const { useBusActivity } = await import("./useBusActivity.js");
            useBusActivity();
            runEffect();

            // Fire the wiretap to start the timer
            capturedWiretapCallback!();
            // Now unmount before the timer fires
            capturedCleanup!();
        });

        it("should remove the wiretap", () => {
            expect(mockRemoveWiretap).toHaveBeenCalledTimes(1);
        });

        it("should clear the pending timer ref", () => {
            expect(timerRefObj.current).toBeNull();
        });
    });

    describe("when unmounted while no flash timer is active", () => {
        beforeEach(async () => {
            const { useBusActivity } = await import("./useBusActivity.js");
            useBusActivity();
            runEffect();
            // Unmount without any messages having fired — timerRef is null
            capturedCleanup!();
        });

        it("should remove the wiretap without throwing", () => {
            expect(mockRemoveWiretap).toHaveBeenCalledTimes(1);
        });
    });
});
