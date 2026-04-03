/** Format a duration in ms into a compact human string (e.g. "1.2s", "340ms"). */
export const formatDuration = (ms: number): string => {
    if (ms >= 1000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${ms}ms`;
};
