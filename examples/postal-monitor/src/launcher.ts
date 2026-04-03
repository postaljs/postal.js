// Launcher — spawns real monorepo tasks and reports events to the monitor.
//
// This script is meant to run alongside the monitor TUI in a second terminal.
// It demonstrates the client side of postal-transport-uds: connect to the
// monitor's socket and publish events as tasks start and finish.
//
// Run it with:
//   pnpm --filter @postal-examples/postal-monitor start:launcher

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createReporter } from "./reporter.js";
import { runTask, type TaskDefinition } from "./task-runner.js";

const SOCKET_PATH = "/tmp/postal-monitor.sock";

// A representative mix of packages and commands. The launcher runs all of
// these concurrently with staggered starts so the monitor shows overlapping
// activity — which is what makes the demo visually interesting.
const TASKS: TaskDefinition[] = [
    { package: "postal", command: "test" },
    { package: "postal", command: "lint" },
    { package: "postal", command: "build" },
    { package: "postal-transport-uds", command: "test" },
    { package: "postal-transport-uds", command: "lint" },
    { package: "postal-transport-childprocess", command: "test" },
    { package: "postal-transport-messageport", command: "test" },
];

/** Random integer in [min, max] inclusive. */
const randomDelay = (min: number, max: number): number =>
    Math.floor(Math.random() * (max - min + 1)) + min;

/** Sleep for the given number of milliseconds. */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Entry point. */
const main = async (): Promise<void> => {
    // Resolve the monorepo root relative to this file's location.
    // __dirname isn't available in ESM, so we derive it from import.meta.url.
    const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../");

    // Guard against running in a repo that hasn't had `pnpm install` run yet.
    // Without node_modules the pnpm filter commands will fail unhelpfully.
    const nodeModulesPath = path.join(monorepoRoot, "node_modules");
    if (!fs.existsSync(nodeModulesPath)) {
        process.stderr.write(
            "Error: node_modules not found at the monorepo root.\n" +
                "Run `pnpm install` from the repo root before launching tasks.\n"
        );
        process.exit(1);
    }

    let reporter;
    try {
        reporter = await createReporter(SOCKET_PATH);
    } catch (err) {
        process.stderr.write(
            `Error: Could not connect to monitor at ${SOCKET_PATH}.\n` +
                "Make sure the monitor is running first:\n" +
                "  pnpm --filter @postal-examples/postal-monitor start:monitor\n\n" +
                `Details: ${String(err)}\n`
        );
        process.exit(1);
    }

    // Handle Ctrl+C gracefully — disconnect before exiting so the monitor
    // doesn't keep a dangling transport reference.
    const shutdown = (): void => {
        reporter.disconnect();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    process.stdout.write(`Launching ${TASKS.length} tasks with staggered starts...\n`);

    // Fire off all tasks concurrently, but stagger the spawns so the monitor
    // shows a rolling wave of activity rather than a simultaneous burst.
    const taskPromises = TASKS.map(async (task, index) => {
        // First task starts immediately; each subsequent task waits an
        // independent random 500–2000ms before spawning. This is a demo, not a queue.
        if (index > 0) {
            await sleep(randomDelay(500, 2000));
        }
        return runTask(task, reporter, monorepoRoot);
    });

    await Promise.all(taskPromises);

    process.stdout.write("All tasks complete. Disconnecting.\n");
    reporter.disconnect();
};

main().catch(err => {
    process.stderr.write(`[launcher] Fatal: ${String(err)}\n`);
    process.exit(1);
});
