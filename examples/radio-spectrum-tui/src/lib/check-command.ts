// Utility for checking whether a command-line tool is available in PATH.
// Used by both main.tsx (preflight before render) and useChildProcesses
// (runtime check before forking children).

import { execFile } from "node:child_process";

/** Resolves true if `cmd` is found in PATH, false otherwise. */
export const checkCommand = (cmd: string): Promise<boolean> =>
    new Promise(resolve => {
        execFile("which", [cmd], err => {
            resolve(err === null);
        });
    });
