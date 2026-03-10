// useBusActivity — flash a boolean true for 100ms on any postal message.
//
// Adds a wiretap (sees all messages on all channels) and debounces
// the activity indicator so rapid-fire PCM messages don't cause
// constant re-renders — the component just sees "active" for 100ms.

import { useEffect, useRef, useState } from "react";
import { addWiretap } from "postal";

const FLASH_DURATION_MS = 100;

/**
 * Returns `true` for 100ms after any postal message fires, then `false`.
 * Useful for a bus activity indicator dot in the header.
 */
export const useBusActivity = (): boolean => {
    const [active, setActive] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const removeWiretap = addWiretap(() => {
            setActive(true);
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(() => {
                setActive(false);
                timerRef.current = null;
            }, FLASH_DURATION_MS);
        });

        return () => {
            removeWiretap();
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, []);

    return active;
};
