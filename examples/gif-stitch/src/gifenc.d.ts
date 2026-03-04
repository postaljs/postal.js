// Minimal ambient declarations for gifenc — the package ships without TypeScript types.
// Only the parts of the API used by encoder.worker.ts are typed here.
declare module "gifenc" {
    /** Creates a GIF encoder instance. */
    export function GIFEncoder(): GIFEncoderInstance;

    export interface GIFEncoderInstance {
        /** Write a frame into the GIF. palette is a Uint8Array of RGB triples. */
        writeFrame(
            indexedPixels: Uint8Array,
            width: number,
            height: number,
            options?: {
                palette?: Uint8Array;
                delay?: number;
                repeat?: number;
                transparent?: number | null;
                transparentIndex?: number;
                colorDepth?: number;
            }
        ): void;
        /** Finalise the GIF and return the bytes. */
        finish(): void;
        /** Returns a Uint8Array view of the encoded GIF bytes. */
        bytes(): Uint8Array;
        /** Returns a Uint8Array view (alias of bytes). */
        bytesView(): Uint8Array;
    }

    /**
     * Quantize RGBA pixel data into a palette.
     * @param data - Flat RGBA Uint8Array
     * @param maxColors - Max palette entries (1–256)
     */
    export function quantize(data: Uint8Array, maxColors: number): Uint8Array;

    /**
     * Map each pixel in the RGBA data to its nearest palette index.
     * @param data - Flat RGBA Uint8Array
     * @param palette - Output of quantize()
     */
    export function applyPalette(data: Uint8Array, palette: Uint8Array): Uint8Array;
}
