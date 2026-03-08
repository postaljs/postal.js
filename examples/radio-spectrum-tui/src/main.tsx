// Entry point — preflight checks, then render the Ink TUI.
//
// Checks are done before render() so we can write clear error messages
// to a clean terminal (not inside Ink's alternate screen).
// The actual child process lifecycle lives in useChildProcesses.

import { render } from "ink";
import App from "./App.js";
import { checkCommand } from "./lib/check-command.js";

const main = async (): Promise<void> => {
    const playAudio = process.argv.includes("--play");

    const hasFFmpeg = await checkCommand("ffmpeg");
    if (!hasFFmpeg) {
        process.stderr.write(
            "Error: ffmpeg not found in PATH.\n" +
                "Install it: brew install ffmpeg (macOS) / apt install ffmpeg (Linux)\n"
        );
        process.exit(1);
    }

    if (playAudio) {
        const hasSox = await checkCommand("play");
        if (!hasSox) {
            process.stderr.write(
                "Error: sox 'play' command not found in PATH.\n" +
                    "Install it: brew install sox (macOS) / apt install sox (Linux)\n" +
                    "Or omit --play to run as a silent visualizer.\n"
            );
            process.exit(1);
        }
    }

    // Clear screen and park cursor at top-left before Ink takes over.
    process.stdout.write("\x1b[2J\x1b[H");

    render(<App playAudio={playAudio} />);
};

main().catch(err => {
    process.stderr.write(`[main] Fatal: ${String(err)}\n`);
    process.exit(1);
});
