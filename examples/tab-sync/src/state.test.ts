// eslint-disable-next-line @typescript-eslint/no-explicit-any
/* eslint-disable import/no-anonymous-default-export */
export default {};

import { DEFAULT_STATE, loadState, saveState, type AppState } from "./state";

// ─── localStorage stub ────────────────────────────────────────────────────────
// The node test environment has no browser globals. We wire up a minimal
// localStorage double on globalThis so the module under test can call through
// it normally. Each beforeEach replaces the stub so tests stay isolated.

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

const makeLocalStorageStub = () => ({
    getItem: mockGetItem,
    setItem: mockSetItem,
    removeItem: jest.fn(),
    clear: jest.fn(),
    key: jest.fn(),
    length: 0,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORED_FULL_STATE: AppState = {
    username: "Buckaroo Banzai",
    theme: "light",
    prefs: {
        sounds: false,
        compactView: true,
    },
};

const STORAGE_KEY = "postal-tab-sync-state";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("state", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        Object.defineProperty(globalThis, "localStorage", {
            value: makeLocalStorageStub(),
            writable: true,
            configurable: true,
        });
    });

    // ─── DEFAULT_STATE ────────────────────────────────────────────────────────

    describe("DEFAULT_STATE", () => {
        it("should have the expected shape and values", () => {
            expect(DEFAULT_STATE).toEqual({
                username: null,
                theme: "dark",
                prefs: {
                    sounds: true,
                    compactView: false,
                },
            });
        });
    });

    // ─── loadState ────────────────────────────────────────────────────────────

    describe("loadState", () => {
        describe("when localStorage contains no stored state", () => {
            let result: AppState;

            beforeEach(() => {
                mockGetItem.mockReturnValue(null);
                result = loadState();
            });

            it("should return a copy of DEFAULT_STATE", () => {
                expect(result).toEqual(DEFAULT_STATE);
            });

            it("should return a new object, not the DEFAULT_STATE reference", () => {
                expect(result).not.toBe(DEFAULT_STATE);
            });
        });

        describe("when localStorage contains a fully-populated stored state", () => {
            let result: AppState;

            beforeEach(() => {
                mockGetItem.mockReturnValue(JSON.stringify(STORED_FULL_STATE));
                result = loadState();
            });

            it("should return the stored values", () => {
                expect(result).toEqual(STORED_FULL_STATE);
            });
        });

        describe("when localStorage contains a state with prefs missing", () => {
            let result: AppState;

            beforeEach(() => {
                const storedWithoutPrefs = { username: "Zaphod Beeblebrox", theme: "light" };
                mockGetItem.mockReturnValue(JSON.stringify(storedWithoutPrefs));
                result = loadState();
            });

            it("should fill in prefs from DEFAULT_STATE", () => {
                expect(result.prefs).toEqual(DEFAULT_STATE.prefs);
            });

            it("should preserve the stored top-level fields", () => {
                expect(result.username).toBe("Zaphod Beeblebrox");
                expect(result.theme).toBe("light");
            });
        });

        describe("when localStorage contains a state with a subset of prefs keys", () => {
            let result: AppState;

            beforeEach(() => {
                const storedWithPartialPrefs = {
                    username: null,
                    theme: "dark",
                    prefs: { sounds: false },
                };
                mockGetItem.mockReturnValue(JSON.stringify(storedWithPartialPrefs));
                result = loadState();
            });

            it("should use the stored pref value for the key that exists", () => {
                expect(result.prefs.sounds).toBe(false);
            });

            it("should fill in the missing pref key from DEFAULT_STATE", () => {
                expect(result.prefs.compactView).toBe(DEFAULT_STATE.prefs.compactView);
            });
        });

        describe("when localStorage throws on getItem", () => {
            let result: AppState;

            beforeEach(() => {
                mockGetItem.mockImplementation(() => {
                    throw new DOMException("Access denied", "SecurityError");
                });
                result = loadState();
            });

            it("should return a copy of DEFAULT_STATE", () => {
                expect(result).toEqual(DEFAULT_STATE);
            });
        });

        describe("when localStorage contains corrupted JSON", () => {
            let result: AppState;

            beforeEach(() => {
                mockGetItem.mockReturnValue("E_CORRUPTED_STROMBOLI{{{{");
                result = loadState();
            });

            it("should return a copy of DEFAULT_STATE", () => {
                expect(result).toEqual(DEFAULT_STATE);
            });
        });

        describe("when localStorage contains an empty string", () => {
            let result: AppState;

            beforeEach(() => {
                mockGetItem.mockReturnValue("");
                result = loadState();
            });

            it("should return a copy of DEFAULT_STATE", () => {
                expect(result).toEqual(DEFAULT_STATE);
            });
        });

        describe("when localStorage contains JSON with extra unknown keys", () => {
            let result: AppState;

            beforeEach(() => {
                const storedWithExtras = {
                    ...STORED_FULL_STATE,
                    unrecognizedField: "do not panic",
                    prefs: { ...STORED_FULL_STATE.prefs, futureFlag: true },
                };
                mockGetItem.mockReturnValue(JSON.stringify(storedWithExtras));
                result = loadState();
            });

            it("should carry through the extra top-level key via spread", () => {
                expect((result as any).unrecognizedField).toBe("do not panic");
            });

            it("should carry through the extra prefs key via spread", () => {
                expect((result.prefs as any).futureFlag).toBe(true);
            });
        });
    });

    // ─── saveState ────────────────────────────────────────────────────────────

    describe("saveState", () => {
        describe("when localStorage setItem succeeds", () => {
            beforeEach(() => {
                mockSetItem.mockReturnValue(undefined);
                saveState(STORED_FULL_STATE);
            });

            it("should call setItem with the storage key", () => {
                expect(mockSetItem).toHaveBeenCalledTimes(1);
                expect(mockSetItem).toHaveBeenCalledWith(
                    STORAGE_KEY,
                    JSON.stringify(STORED_FULL_STATE)
                );
            });
        });

        describe("when localStorage setItem throws", () => {
            beforeEach(() => {
                mockSetItem.mockImplementation(() => {
                    throw new DOMException("QuotaExceededError", "QuotaExceededError");
                });
            });

            it("should not throw", () => {
                expect(() => saveState(STORED_FULL_STATE)).not.toThrow();
            });
        });
    });
});
