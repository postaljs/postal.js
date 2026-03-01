/**
 * AMQP-style topic matching for postal's pub/sub system.
 *
 * Topics are dot-delimited strings (e.g., "order.placed.domestic").
 * Subscription patterns support two wildcards:
 *   - `*` matches exactly one segment
 *   - `#` matches zero or more segments (per AMQP standard)
 *
 * Match results are cached in a module-level Map for repeated lookups.
 * @module
 */

/**
 * Recursively matches pattern segments against topic segments.
 *
 * Walks both arrays in lockstep. Literal segments must match exactly,
 * `*` consumes one topic segment, and `#` uses backtracking to try
 * consuming 0..N remaining topic segments until a full match is found.
 */
const matchSegments = (
    patternSegments: string[],
    topicSegments: string[],
    patternIndex: number,
    topicIndex: number
): boolean => {
    // Pattern fully consumed — only a match if topic is also fully consumed
    if (patternIndex === patternSegments.length) {
        return topicIndex === topicSegments.length;
    }

    const segment = patternSegments[patternIndex];

    // # can consume zero segments, so it must run even when the topic is exhausted.
    // This is what distinguishes # from * — it doesn't require remaining topic segments.
    if (segment === "#") {
        for (let consumed = 0; consumed <= topicSegments.length - topicIndex; consumed++) {
            if (
                matchSegments(
                    patternSegments,
                    topicSegments,
                    patternIndex + 1,
                    topicIndex + consumed
                )
            ) {
                return true;
            }
        }
        return false;
    }

    // Everything below (*, literals) requires at least one remaining topic segment
    if (topicIndex === topicSegments.length) {
        return false;
    }

    if (segment === "*") {
        return matchSegments(patternSegments, topicSegments, patternIndex + 1, topicIndex + 1);
    }

    // Literal segment — must match exactly before continuing
    return (
        segment === topicSegments[topicIndex] &&
        matchSegments(patternSegments, topicSegments, patternIndex + 1, topicIndex + 1)
    );
};

/** Module-level cache for match results. Keyed by `pattern\0topic`. */
const cache = new Map<string, boolean>();

/**
 * Tests whether a subscription pattern matches a published topic.
 *
 * @param pattern - The subscription pattern, which may include `*` and `#` wildcards
 * @param topic - The published topic string (no wildcards)
 * @returns `true` if the pattern matches the topic
 *
 * @example
 * matchTopic("order.*", "order.placed")        // true
 * matchTopic("order.#", "order.placed.rush")    // true
 * matchTopic("order.#", "order")                // true  (# matches zero segments)
 * matchTopic("order.*", "order.placed.rush")    // false (* matches exactly one)
 */
export const matchTopic = (pattern: string, topic: string): boolean => {
    // Fast path — identical strings don't need segment parsing
    if (pattern === topic) {
        return true;
    }

    // Null byte can't appear in topic strings, so it's a safe cache key delimiter
    const key = `${pattern}\0${topic}`;
    const cached = cache.get(key);
    if (cached !== undefined) {
        return cached;
    }

    const result = matchSegments(pattern.split("."), topic.split("."), 0, 0);
    cache.set(key, result);
    return result;
};

/**
 * Clears the topic match result cache. Primarily useful for testing
 * and for cleanup when channels are disposed.
 */
export const clearMatchCache = (): void => {
    cache.clear();
};

// --- Type-level topic matching ---

/**
 * Given a channel map `TMap` and a subscription `Pattern`, resolves the union
 * of payload types for all topics in the map that the pattern would match.
 *
 * Handles common subscription patterns without recursive type gymnastics:
 *
 *   - Exact key: `"order.placed"` → specific payload type
 *   - Trailing `.*`: `"order.*"` → keys with exactly one segment after prefix
 *   - Trailing `.#`: `"order.#"` → prefix itself + keys with segments after prefix
 *   - Bare `#`: all values in the map
 *   - Bare `*`: single-segment keys only
 *   - Complex patterns: falls back to union of all values (safe but imprecise)
 *
 * @example
 * type Map = {
 *   "order.placed": { id: string };
 *   "order.cancelled": { id: string; reason: string };
 * };
 * type T = PayloadFor<Map, "order.*">;
 * // T = { id: string } | { id: string; reason: string }
 */
export type PayloadFor<TMap, Pattern extends string> =
    // Exact match — pattern is a literal key in the map
    Pattern extends keyof TMap
        ? TMap[Pattern]
        : // Trailing .# — prefix itself (zero segments) + keys starting with prefix (one or more)
          Pattern extends `${infer Prefix}.#`
          ? {
                [K in Extract<keyof TMap, string>]: K extends Prefix
                    ? TMap[K]
                    : K extends `${Prefix}.${string}`
                      ? TMap[K]
                      : never;
            }[Extract<keyof TMap, string>]
          : // Trailing .* — only keys with exactly one segment after prefix.
            // The nested conditional excludes keys with two+ segments (e.g., "a.b.c"
            // is excluded when prefix is "a" because it extends "a.${string}.${string}")
            Pattern extends `${infer Prefix}.*`
            ? {
                  [K in Extract<keyof TMap, string>]: K extends `${Prefix}.${string}`
                      ? K extends `${Prefix}.${string}.${string}`
                          ? never
                          : TMap[K]
                      : never;
              }[Extract<keyof TMap, string>]
            : // Bare # — matches everything, return union of all values
              Pattern extends "#"
              ? TMap[keyof TMap]
              : // Bare * — only single-segment keys (no dots)
                Pattern extends "*"
                ? {
                      [K in Extract<keyof TMap, string>]: K extends `${string}.${string}`
                          ? never
                          : TMap[K];
                  }[Extract<keyof TMap, string>]
                : // Complex/unrecognized wildcard pattern — union of all values as safe fallback
                  TMap[keyof TMap];
