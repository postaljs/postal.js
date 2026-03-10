// Color utilities extracted from the original ansi.ts.
//
// These are pure math functions — no ANSI escape codes, no chalk calls.
// Ink and chalk handle the actual terminal coloring; these just compute
// which color to use at a given position in a gradient.

/**
 * Linearly interpolate between two RGB colors at position t (0–1).
 * Returns [r, g, b] as integers 0–255.
 */
export const lerpColor = (
    a: [number, number, number],
    b: [number, number, number],
    t: number
): [number, number, number] => [
    Math.round(a[0] + (b[0] - a[0]) * t) || 0,
    Math.round(a[1] + (b[1] - a[1]) * t) || 0,
    Math.round(a[2] + (b[2] - a[2]) * t) || 0,
];

// Spectrum gradient: low freq (blue) → bass (cyan) → mids (green) → upper-mids (yellow) → highs (red-orange).
const SPECTRUM_GRADIENT: Array<[number, number, number]> = [
    [0, 80, 220], // deep blue — sub-bass
    [0, 200, 220], // cyan — bass
    [0, 220, 80], // green — mids
    [220, 220, 0], // yellow — upper mids
    [220, 60, 0], // red-orange — highs
];

/**
 * Return the RGB color for a frequency position in [0, 1].
 * Walks through the spectrum gradient stops.
 */
export const spectrumColor = (position: number): [number, number, number] => {
    const clamped = Math.max(0, Math.min(1, position));
    const scaled = clamped * (SPECTRUM_GRADIENT.length - 1);
    const lo = Math.floor(scaled);
    const hi = Math.min(SPECTRUM_GRADIENT.length - 1, lo + 1);
    const t = scaled - lo;
    return lerpColor(SPECTRUM_GRADIENT[lo], SPECTRUM_GRADIENT[hi], t);
};

/**
 * Return the RGB color for a VU level in [0, 1].
 * Green at low levels, yellow mid, red near clipping — classic VU behavior.
 */
export const vuColor = (level: number): [number, number, number] => {
    if (level < 0.6) {
        return lerpColor([0, 200, 0], [180, 220, 0], level / 0.6);
    } else if (level < 0.85) {
        return lerpColor([180, 220, 0], [220, 160, 0], (level - 0.6) / 0.25);
    } else {
        return lerpColor([220, 80, 0], [255, 0, 0], (level - 0.85) / 0.15);
    }
};
