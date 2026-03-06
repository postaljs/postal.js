/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import {
    enterAltScreen,
    exitAltScreen,
    hideCursor,
    showCursor,
    cursorHome,
    clearToEnd,
    moveTo,
    eraseLine,
    reset,
    dim,
    bold,
    fg,
    fgChar,
} from "./ansi.js";

const ANSI_RESET = "\x1b[0m";

describe("ansi", () => {
    describe("enterAltScreen", () => {
        let result: string;

        beforeEach(() => {
            result = enterAltScreen();
        });

        it("should return the alternate screen enter escape sequence", () => {
            expect(result).toBe("\x1b[?1049h");
        });
    });

    describe("exitAltScreen", () => {
        let result: string;

        beforeEach(() => {
            result = exitAltScreen();
        });

        it("should return the alternate screen exit escape sequence", () => {
            expect(result).toBe("\x1b[?1049l");
        });
    });

    describe("hideCursor", () => {
        let result: string;

        beforeEach(() => {
            result = hideCursor();
        });

        it("should return the hide cursor escape sequence", () => {
            expect(result).toBe("\x1b[?25l");
        });
    });

    describe("showCursor", () => {
        let result: string;

        beforeEach(() => {
            result = showCursor();
        });

        it("should return the show cursor escape sequence", () => {
            expect(result).toBe("\x1b[?25h");
        });
    });

    describe("cursorHome", () => {
        let result: string;

        beforeEach(() => {
            result = cursorHome();
        });

        it("should return the cursor home escape sequence", () => {
            expect(result).toBe("\x1b[H");
        });
    });

    describe("clearToEnd", () => {
        let result: string;

        beforeEach(() => {
            result = clearToEnd();
        });

        it("should return the clear-to-end-of-screen escape sequence", () => {
            expect(result).toBe("\x1b[J");
        });
    });

    describe("moveTo", () => {
        describe("when moving to row 5 column 12", () => {
            let result: string;

            beforeEach(() => {
                result = moveTo(5, 12);
            });

            it("should return an ANSI CUP escape with the correct row and column", () => {
                expect(result).toBe("\x1b[5;12H");
            });
        });
    });

    describe("eraseLine", () => {
        let result: string;

        beforeEach(() => {
            result = eraseLine();
        });

        it("should contain the erase line escape sequence", () => {
            expect(result).toContain("\x1b[2K");
        });

        it("should end with a carriage return", () => {
            expect(result.endsWith("\r")).toBe(true);
        });
    });

    describe("reset", () => {
        let result: string;

        beforeEach(() => {
            result = reset();
        });

        it("should return the SGR reset escape sequence", () => {
            expect(result).toBe(ANSI_RESET);
        });
    });

    describe("dim", () => {
        describe("when wrapping the text 'STATUS'", () => {
            let result: string;

            beforeEach(() => {
                result = dim("STATUS");
            });

            it("should open with the dim SGR code", () => {
                expect(result).toContain("\x1b[2m");
            });

            it("should contain the wrapped text", () => {
                expect(result).toContain("STATUS");
            });

            it("should close with a reset", () => {
                expect(result.endsWith(ANSI_RESET)).toBe(true);
            });
        });
    });

    describe("bold", () => {
        describe("when wrapping the text 'FPS'", () => {
            let result: string;

            beforeEach(() => {
                result = bold("FPS");
            });

            it("should open with the bold SGR code", () => {
                expect(result).toContain("\x1b[1m");
            });

            it("should contain the wrapped text", () => {
                expect(result).toContain("FPS");
            });

            it("should close with a reset", () => {
                expect(result.endsWith(ANSI_RESET)).toBe(true);
            });
        });
    });

    describe("fg", () => {
        describe("when applying cyan (0, 200, 255) to 'HELLO'", () => {
            let result: string;

            beforeEach(() => {
                result = fg(0, 200, 255, "HELLO");
            });

            it("should contain the 24-bit foreground escape for the given color", () => {
                expect(result).toContain("\x1b[38;2;0;200;255m");
            });

            it("should contain the text", () => {
                expect(result).toContain("HELLO");
            });

            it("should end with a reset", () => {
                expect(result.endsWith(ANSI_RESET)).toBe(true);
            });
        });
    });

    describe("fgChar", () => {
        describe("when applying green (0, 255, 0) to the character 'X'", () => {
            let result: string;

            beforeEach(() => {
                result = fgChar(0, 255, 0, "X");
            });

            it("should contain the 24-bit foreground escape", () => {
                expect(result).toContain("\x1b[38;2;0;255;0m");
            });

            it("should contain the character", () => {
                expect(result).toContain("X");
            });

            it("should NOT end with a reset (reset is intentionally deferred to end-of-line)", () => {
                // fgChar is used in tight inner loops — the reset is batched to end-of-row
                // in buildColorFrame to reduce escape byte output.
                expect(result.endsWith(ANSI_RESET)).toBe(false);
            });
        });
    });
});
