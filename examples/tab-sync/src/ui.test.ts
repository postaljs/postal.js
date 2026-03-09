// eslint-disable-next-line @typescript-eslint/no-explicit-any
/* eslint-disable import/no-anonymous-default-export */
export default {};

import { setConnectedTabCount, hideConnectedTabCount } from "./ui";

// ─── DOM stub ────────────────────────────────────────────────────────────────
// Provides a minimal document.getElementById stub so DOM functions can run in
// the node test environment without jsdom. Each beforeEach replaces the stub
// so tests stay isolated.

const makeElStub = () => ({
    textContent: null as string | null,
    style: { display: "" },
});

type ElStub = ReturnType<typeof makeElStub>;

const makeDocumentStub = (elements: Record<string, ElStub | null>) => ({
    getElementById: (id: string) => elements[id] ?? null,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ui", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });

    describe("setConnectedTabCount", () => {
        describe("when both required elements exist", () => {
            let countEl: ElStub, containerEl: ElStub;

            beforeEach(() => {
                countEl = makeElStub();
                containerEl = makeElStub();
                containerEl.style.display = "none";

                Object.defineProperty(globalThis, "document", {
                    value: makeDocumentStub({
                        "connected-tabs": countEl,
                        "connected-tabs-container": containerEl,
                    }),
                    writable: true,
                    configurable: true,
                });

                setConnectedTabCount(3);
            });

            it("should set the count element's textContent to the stringified count", () => {
                expect(countEl.textContent).toBe("3");
            });

            it("should clear the container's display style to make it visible", () => {
                expect(containerEl.style.display).toBe("");
            });
        });

        describe("when the connected-tabs element is missing", () => {
            let error: unknown;

            beforeEach(() => {
                Object.defineProperty(globalThis, "document", {
                    value: makeDocumentStub({
                        "connected-tabs": null,
                        "connected-tabs-container": makeElStub(),
                    }),
                    writable: true,
                    configurable: true,
                });

                try {
                    setConnectedTabCount(1);
                } catch (err) {
                    error = err;
                }
            });

            it("should throw with a message identifying the missing element", () => {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toMatch(/connected-tabs/);
            });
        });
    });

    describe("hideConnectedTabCount", () => {
        describe("when the container element exists", () => {
            let containerEl: ElStub;

            beforeEach(() => {
                containerEl = makeElStub();
                containerEl.style.display = "";

                Object.defineProperty(globalThis, "document", {
                    value: makeDocumentStub({
                        "connected-tabs-container": containerEl,
                    }),
                    writable: true,
                    configurable: true,
                });

                hideConnectedTabCount();
            });

            it("should set the container's display style to 'none'", () => {
                expect(containerEl.style.display).toBe("none");
            });
        });

        describe("when the container element is missing", () => {
            let error: unknown;

            beforeEach(() => {
                Object.defineProperty(globalThis, "document", {
                    value: makeDocumentStub({
                        "connected-tabs-container": null,
                    }),
                    writable: true,
                    configurable: true,
                });

                try {
                    hideConnectedTabCount();
                } catch (err) {
                    error = err;
                }
            });

            it("should throw with a message identifying the missing element", () => {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toMatch(/connected-tabs-container/);
            });
        });
    });
});
