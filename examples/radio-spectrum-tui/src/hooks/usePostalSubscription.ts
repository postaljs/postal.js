// usePostalSubscription — bridge a postal topic into React state.
//
// Throttles state updates to ~30fps so Ink doesn't re-render on every
// incoming PCM chunk (~21/sec × 4 subscriptions would be noisy).
// The ref holds the latest value between renders; the state setter
// triggers the actual re-render on the throttle tick.

import { useEffect, useRef, useState } from "react";
import { getChannel } from "postal";

const THROTTLE_MS = 33; // ~30fps

/**
 * Subscribe to a postal topic on `channelName`, returning the latest payload.
 *
 * Returns `null` until the first message arrives on the topic.
 * Automatically unsubscribes when the component unmounts.
 *
 * Pass a `resetKey` to clear stale data when context changes (e.g. station
 * switch). When `resetKey` changes, the stored value resets to `null` and a
 * re-render is triggered so the UI doesn't show stale data.
 */
export const usePostalSubscription = <T>(
    channelName: string,
    topic: string,
    resetKey?: unknown
): T | null => {
    const [, setTick] = useState(0);
    const latestRef = useRef<T | null>(null);
    // Track whether a new value has arrived since the last throttle tick.
    const pendingRef = useRef(false);
    const throttleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Reset stored value when resetKey changes (e.g. station switch).
    const prevResetKeyRef = useRef(resetKey);
    if (resetKey !== prevResetKeyRef.current) {
        prevResetKeyRef.current = resetKey;
        latestRef.current = null;
        pendingRef.current = true;
    }

    useEffect(() => {
        const channel = getChannel(channelName);

        // subscribe() returns an unsubscribe function directly (not an object).
        const unsubscribe = channel.subscribe(topic, envelope => {
            latestRef.current = envelope.payload as T;
            pendingRef.current = true;
        });

        // Throttle re-renders to ~30fps. Only trigger when new data arrived.
        throttleTimerRef.current = setInterval(() => {
            if (pendingRef.current) {
                pendingRef.current = false;
                setTick(t => t + 1);
            }
        }, THROTTLE_MS);

        return () => {
            unsubscribe();
            if (throttleTimerRef.current !== null) {
                clearInterval(throttleTimerRef.current);
                throttleTimerRef.current = null;
            }
        };
    }, [channelName, topic]);

    return latestRef.current;
};
