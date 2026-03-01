export default {};

import { matchTopic, clearMatchCache, type PayloadFor } from "./topicMatch";

// ---------------------------------------------------------------------------
// Runtime matching
// ---------------------------------------------------------------------------

describe("topicMatch", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearMatchCache();
    });

    describe("matchTopic", () => {
        // --- Exact matching ---

        describe("when pattern and topic are identical", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("order.placed", "order.placed");
            });

            it("should match", () => {
                expect(result).toBe(true);
            });
        });

        describe("when pattern and topic differ", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("order.placed", "order.cancelled");
            });

            it("should not match", () => {
                expect(result).toBe(false);
            });
        });

        describe("when pattern is a prefix of the topic", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("order", "order.placed");
            });

            it("should not match", () => {
                expect(result).toBe(false);
            });
        });

        describe("when topic is a prefix of the pattern", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("order.placed", "order");
            });

            it("should not match", () => {
                expect(result).toBe(false);
            });
        });

        // --- * wildcard (exactly one segment) ---

        describe("when trailing * has one segment to match", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("order.*", "order.placed");
            });

            it("should match", () => {
                expect(result).toBe(true);
            });
        });

        describe("when trailing * has zero segments to match", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("order.*", "order");
            });

            it("should not match", () => {
                expect(result).toBe(false);
            });
        });

        describe("when trailing * has multiple segments to match", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("order.*", "order.placed.domestic");
            });

            it("should not match", () => {
                expect(result).toBe(false);
            });
        });

        describe("when leading * has one segment to match", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("*.placed", "order.placed");
            });

            it("should match", () => {
                expect(result).toBe(true);
            });
        });

        describe("when * is in the middle and segments align", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("order.*.domestic", "order.placed.domestic");
            });

            it("should match", () => {
                expect(result).toBe(true);
            });
        });

        describe("when * is in the middle and trailing literal doesn't match", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("order.*.domestic", "order.placed.international");
            });

            it("should not match", () => {
                expect(result).toBe(false);
            });
        });

        describe("when bare * matches a single-segment topic", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("*", "order");
            });

            it("should match", () => {
                expect(result).toBe(true);
            });
        });

        describe("when bare * encounters a multi-segment topic", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("*", "order.placed");
            });

            it("should not match", () => {
                expect(result).toBe(false);
            });
        });

        describe("when multiple * wildcards match the segment count exactly", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("*.*", "order.placed");
            });

            it("should match", () => {
                expect(result).toBe(true);
            });
        });

        describe("when multiple * wildcards exceed the segment count", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("*.*", "order");
            });

            it("should not match", () => {
                expect(result).toBe(false);
            });
        });

        describe("when multiple * wildcards fall short of the segment count", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("*.*", "a.b.c");
            });

            it("should not match", () => {
                expect(result).toBe(false);
            });
        });

        // --- # wildcard (zero or more segments) ---

        describe("when trailing # matches one segment", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("order.#", "order.placed");
            });

            it("should match", () => {
                expect(result).toBe(true);
            });
        });

        describe("when trailing # matches zero segments", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("order.#", "order");
            });

            it("should match", () => {
                expect(result).toBe(true);
            });
        });

        describe("when bare # encounters any topic", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("#", "order.placed.domestic");
            });

            it("should match", () => {
                expect(result).toBe(true);
            });
        });

        describe("when leading # matches zero preceding segments", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("#.placed", "placed");
            });

            it("should match", () => {
                expect(result).toBe(true);
            });
        });

        describe("when leading # matches one or more preceding segments", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("#.placed", "order.placed");
            });

            it("should match", () => {
                expect(result).toBe(true);
            });
        });

        describe("when middle # matches zero segments", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("order.#.express", "order.express");
            });

            it("should match", () => {
                expect(result).toBe(true);
            });
        });

        describe("when middle # matches one or more segments", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("order.#.express", "order.placed.domestic.express");
            });

            it("should match", () => {
                expect(result).toBe(true);
            });
        });

        // --- Mixed wildcards ---

        describe("when * is followed by # and # consumes zero", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("*.#", "order");
            });

            it("should match", () => {
                expect(result).toBe(true);
            });
        });

        describe("when # is followed by * with a single-segment topic", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("#.*", "order");
            });

            it("should match", () => {
                expect(result).toBe(true);
            });
        });

        describe("when pattern has * then # and # consumes zero", () => {
            let result: boolean;

            beforeEach(() => {
                result = matchTopic("order.*.#", "order.placed");
            });

            it("should match", () => {
                expect(result).toBe(true);
            });
        });

        // --- Caching ---

        describe("when the same pattern/topic pair is matched twice", () => {
            let firstResult: boolean, secondResult: boolean;

            beforeEach(() => {
                firstResult = matchTopic("order.*", "order.placed");
                secondResult = matchTopic("order.*", "order.placed");
            });

            it("should return the same result", () => {
                expect(secondResult).toBe(firstResult);
            });
        });

        describe("when the cache is populated and a second call is made", () => {
            let splitCallsAfterCacheWarmed: number;

            beforeEach(() => {
                // Warm the cache — first call must compute via matchSegments,
                // which requires splitting both pattern and topic on ".".
                matchTopic("order.*", "order.placed");

                // Spy on String.prototype.split so we can count invocations
                // from this point forward. A cache hit returns before any split.
                const originalSplit = String.prototype.split;
                let dotSplitCount = 0;
                jest.spyOn(String.prototype, "split").mockImplementation(function (
                    this: string,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ...args: any[]
                ) {
                    if (args[0] === ".") {
                        dotSplitCount++;
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return (originalSplit as any).apply(this, args);
                });

                matchTopic("order.*", "order.placed");
                splitCallsAfterCacheWarmed = dotSplitCount;

                jest.restoreAllMocks();
            });

            it("should not invoke the segment splitter on a cache hit", () => {
                expect(splitCallsAfterCacheWarmed).toBe(0);
            });
        });
    });

    describe("clearMatchCache", () => {
        describe("when cache is cleared between identical lookups", () => {
            let resultBefore: boolean, resultAfter: boolean;

            beforeEach(() => {
                resultBefore = matchTopic("order.*", "order.placed");
                clearMatchCache();
                resultAfter = matchTopic("order.*", "order.placed");
            });

            it("should produce the same result", () => {
                expect(resultAfter).toBe(resultBefore);
            });
        });
    });
});

// ---------------------------------------------------------------------------
// Type-level matching (PayloadFor)
//
// Compile-time-only tests. If the types are wrong, ts-jest will report a
// type error and the test suite fails — no runtime assertions needed.
// The Assert<IsExact<...>> pattern errors at compile time when T and U
// aren't bidirectionally assignable.
// ---------------------------------------------------------------------------

type IsExact<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;
type Assert<T extends true> = T;

type TestMap = {
    item: { id: string };
    "item.placed": { sku: string; qty: number };
    "item.cancelled": { sku: string; reason: string };
    "item.updated": { sku: string; qty: number };
    "item.placed.domestic": { sku: string; qty: number; region: string };
    "item.placed.domestic.express": { sku: string; qty: number; region: string; speed: string };
    status: { online: boolean };
};

// Exact match — pattern is a literal key in the map
type _t1 = Assert<IsExact<PayloadFor<TestMap, "item.placed">, { sku: string; qty: number }>>;
type _t2 = Assert<IsExact<PayloadFor<TestMap, "status">, { online: boolean }>>;

// Trailing .* — one segment after prefix, excludes deeper keys
// item.placed and item.updated share a shape, so TS collapses the union
type _t3 = Assert<
    IsExact<
        PayloadFor<TestMap, "item.*">,
        { sku: string; qty: number } | { sku: string; reason: string }
    >
>;

// Trailing .# — zero or more segments after prefix (includes prefix itself)
type _t4 = Assert<
    IsExact<
        PayloadFor<TestMap, "item.#">,
        | { id: string }
        | { sku: string; qty: number }
        | { sku: string; reason: string }
        | { sku: string; qty: number; region: string }
        | { sku: string; qty: number; region: string; speed: string }
    >
>;

// Deeper .# prefix — includes the prefix key itself (zero segments after)
type _t5 = Assert<
    IsExact<
        PayloadFor<TestMap, "item.placed.#">,
        | { sku: string; qty: number }
        | { sku: string; qty: number; region: string }
        | { sku: string; qty: number; region: string; speed: string }
    >
>;

// Bare # — union of every value in the map
type _t6 = Assert<IsExact<PayloadFor<TestMap, "#">, TestMap[keyof TestMap]>>;

// Bare * — single-segment keys only (no dots in the key)
type _t7 = Assert<IsExact<PayloadFor<TestMap, "*">, { id: string } | { online: boolean }>>;

// Type aliases are checked at compile time by ts-jest — no runtime usage needed.
// The _t prefix suppresses unused-variable warnings.
