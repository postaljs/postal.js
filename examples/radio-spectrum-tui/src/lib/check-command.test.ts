/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

jest.mock("node:child_process");

const mockExecFile = jest.fn();

jest.mock("node:child_process", () => ({
    execFile: mockExecFile,
}));

describe("checkCommand", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });

    describe("when the command is found in PATH", () => {
        let result: boolean;

        beforeEach(async () => {
            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], cb: (err: null) => void) => {
                    cb(null);
                }
            );

            const { checkCommand } = await import("./check-command.js");
            result = await checkCommand("ffmpeg");
        });

        it("should return true", () => {
            expect(result).toBe(true);
        });

        it("should call execFile with which and the command name", () => {
            expect(mockExecFile).toHaveBeenCalledTimes(1);
            expect(mockExecFile).toHaveBeenCalledWith("which", ["ffmpeg"], expect.any(Function));
        });
    });

    describe("when the command is not found in PATH", () => {
        let result: boolean;

        beforeEach(async () => {
            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], cb: (err: Error) => void) => {
                    cb(new Error("E_COMMAND_NOT_IN_PATH"));
                }
            );

            const { checkCommand } = await import("./check-command.js");
            result = await checkCommand("sox");
        });

        it("should return false", () => {
            expect(result).toBe(false);
        });
    });
});
