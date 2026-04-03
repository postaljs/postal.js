// task-runner.ts — spawns a single pnpm task and reports its outcome.
//
// Extracted from launcher.ts so it can be imported in tests without
// dragging in the import.meta.url-based monorepo root resolution in main().

import { spawn } from "node:child_process";

/** A task definition: which package and which pnpm script to run. */
export type TaskDefinition = {
    /** The npm package name to pass to pnpm --filter (e.g. "postal"). */
    package: string;
    /** The pnpm script to run (e.g. "test", "lint", "build"). */
    command: string;
};

/** Minimal reporter surface needed by runTask. */
export type TaskReporter = {
    reportStarted: (info: { package: string; command: string; pid: number }) => string;
    reportFinished: (info: {
        taskId: string;
        package: string;
        command: string;
        pid: number;
        success: boolean;
        duration: number;
        error?: string;
    }) => void;
};

/**
 * Run a single pnpm task, reporting start and finish events via the reporter.
 *
 * Returns a promise that resolves when the child process exits.
 * Never rejects — failures are reported via reportFinished with success: false.
 */
export const runTask = (
    task: TaskDefinition,
    reporter: TaskReporter,
    monorepoRoot: string
): Promise<void> => {
    return new Promise(resolve => {
        const startedAt = Date.now();

        // Spawn the real pnpm command. stdio is ignored — we only care about
        // the exit code for the success/failure report to the monitor.
        const child = spawn("pnpm", ["--filter", task.package, task.command], {
            cwd: monorepoRoot,
            stdio: "ignore",
        });

        // The PID may be undefined if spawn fails immediately (e.g. pnpm not found).
        // Default to 0 so the monitor still gets a valid (if useless) event.
        const pid = child.pid ?? 0;

        const taskId = reporter.reportStarted({
            package: task.package,
            command: task.command,
            pid,
        });

        // Node fires both 'error' and 'close' when spawn fails (e.g. binary not found).
        // This guard ensures we only call reportFinished once.
        let settled = false;

        child.on("close", exitCode => {
            if (settled) {
                return;
            }
            settled = true;

            const duration = Date.now() - startedAt;
            const success = exitCode === 0;

            reporter.reportFinished({
                taskId,
                package: task.package,
                command: task.command,
                pid,
                success,
                duration,
                ...(success ? {} : { error: `exited with code ${exitCode ?? "null"}` }),
            });

            resolve();
        });

        // If spawn itself errors (e.g. pnpm binary not found) treat it as a failure.
        child.on("error", err => {
            if (settled) {
                return;
            }
            settled = true;

            const duration = Date.now() - startedAt;

            reporter.reportFinished({
                taskId,
                package: task.package,
                command: task.command,
                pid,
                success: false,
                duration,
                error: err.message,
            });

            resolve();
        });
    });
};
