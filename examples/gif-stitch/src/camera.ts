/**
 * Camera access and frame capture utilities.
 *
 * These are deliberately pure DOM/canvas functions with no postal coupling —
 * they take and return plain data. Postal wiring happens in main.ts, which
 * calls these functions and decides what to do with the results.
 */

/**
 * Requests camera access and attaches the stream to the provided video element.
 * Throws if the user denies permission or the device is unavailable.
 */
export const initCamera = async (video: HTMLVideoElement): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: {
            // Reasonable resolution for GIF output — high enough to look good,
            // low enough that frame transfer overhead stays manageable.
            width: { ideal: 640 },
            height: { ideal: 480 },
        },
        audio: false,
    });

    video.srcObject = stream;
    await video.play();

    return stream;
};

/**
 * Draws the current video frame onto the canvas and returns the raw pixel data.
 * The canvas must be sized to match width/height before calling this.
 */
export const captureFrame = (video: HTMLVideoElement, canvas: HTMLCanvasElement): ImageData => {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Could not get 2D canvas context");
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/**
 * Captures N frames from the video element at the specified interval.
 *
 * Returns a Promise that resolves with all captured ImageData objects once
 * the full sequence completes. The onFrameCaptured callback fires after each
 * frame so callers can show progress without waiting for the whole batch.
 *
 * The interval is honored with setTimeout rather than setInterval so that
 * each capture only starts after the previous one completes — avoids piling
 * up captures if the canvas draw takes longer than expected.
 */
export const captureFrames = (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    count: number,
    intervalMs: number,
    onFrameCaptured?: (capturedSoFar: number, total: number) => void
): Promise<ImageData[]> => {
    return new Promise((resolve, reject) => {
        const frames: ImageData[] = [];

        const captureNext = (): void => {
            try {
                const frame = captureFrame(video, canvas);
                frames.push(frame);
                onFrameCaptured?.(frames.length, count);

                if (frames.length >= count) {
                    resolve(frames);
                } else {
                    setTimeout(captureNext, intervalMs);
                }
            } catch (err) {
                reject(err);
            }
        };

        captureNext();
    });
};
