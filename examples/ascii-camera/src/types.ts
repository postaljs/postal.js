// Shared types for the ASCII camera example.
// Workers and main thread both import from here — keep it free of any
// Node.js or postal imports so it's safe to import anywhere.
//
// The ChannelRegistry augmentation below tells postal what payload types
// flow on each topic of the "camera" channel. This is a compile-time-only
// ambient declaration — no runtime import is introduced. Once declared,
// getChannel("camera") returns a fully typed Channel and subscribe/publish
// infer payload types automatically instead of falling back to `unknown`.

/** Payload for camera.frame messages published by the worker. */
export type FramePayload = {
    /** Fully rendered ASCII string, newlines included. */
    frame: string;
    /** ASCII grid columns (matches CAPTURE_WIDTH in the worker). */
    width: number;
    /** ASCII grid rows (matches CAPTURE_HEIGHT in the worker). */
    height: number;
    /** Actual frames-per-second the worker is achieving. */
    fps: number;
    colorMode: boolean;
};

/** Payload for camera.control messages published by main. */
export type ControlPayload =
    | { action: "set-color-mode"; value: boolean }
    | { action: "set-fps"; value: number }
    | { action: "quit" };

/** Payload for camera.status messages published by the worker. */
export type StatusPayload = {
    status: "starting" | "streaming" | "error";
    /** Error detail — only set when status is "error". */
    message?: string;
};

// --- Channel registry augmentation ---

declare module "postal" {
    interface ChannelRegistry {
        camera: {
            "camera.frame": FramePayload;
            "camera.control": ControlPayload;
            "camera.status": StatusPayload;
        };
    }
}
