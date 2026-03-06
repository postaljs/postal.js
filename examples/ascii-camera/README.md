# @postal-examples/ascii-camera

Live camera feed rendered as ASCII art in your terminal, powered by ffmpeg and postal's MessagePort transport across Node.js worker threads.

```
████████████████████████████████████████████████████████████████
███ 12 fps  ·  COLOR  ·  c: toggle color  ·  +/-: fps  ·  q: quit ████
```

## Prerequisites

- Node.js 22+
- [ffmpeg](https://ffmpeg.org/download.html) in your `PATH`
- A webcam

## Run

From the repo root:

```bash
pnpm install
pnpm --filter @postal-examples/ascii-camera start
```

## Keyboard Controls

| Key           | Action                       |
| ------------- | ---------------------------- |
| `c`           | Toggle color / mono mode     |
| `+` or `=`    | Increase target FPS (max 30) |
| `-`           | Decrease target FPS (min 5)  |
| `q` or Ctrl-C | Quit                         |

## How It Works

The app splits across two threads connected by postal's MessagePort transport:

```
Main Thread                          Worker Thread
──────────────────────               ──────────────────────────────
keyboard input          ──control──> subscribe camera.control
render ASCII frames    <──frames───  publish camera.frame
wiretap (fps HUD)      <──frames───  (same messages, no changes)
show status messages   <──status───  publish camera.status
```

- The **worker thread** spawns ffmpeg, buffers its raw RGB24 stdout into complete frames, converts each frame to ASCII, and publishes it on the `camera` channel.
- The **main thread** subscribes to `camera.frame` to render each frame to the terminal, and publishes `camera.control` messages when the user presses a key.
- A **wiretap** on the main thread counts `camera.frame` messages to compute an independent FPS measurement for the HUD — zero coupling to the frame subscription.

### Channels and Topics

| Topic            | Direction     | Payload                                |
| ---------------- | ------------- | -------------------------------------- |
| `camera.frame`   | worker → main | Rendered ASCII string, dimensions, FPS |
| `camera.control` | main → worker | `set-color-mode`, `set-fps`, or `quit` |
| `camera.status`  | worker → main | `starting`, `streaming`, or `error`    |

### Modes

**Mono** maps each pixel's Rec. 601 luminance to a character from the ramp ` .:-=+*%#@`. Fast and clean.

**Color** wraps each character in a 24-bit ANSI foreground escape. To keep output size manageable, colors are quantized to the nearest step of 8 and escape sequences are deduplicated — a new escape is only emitted when the quantized color changes from the previous pixel.

## Platform Support

| Platform | Input device                     |
| -------- | -------------------------------- |
| macOS    | AVFoundation (`-f avfoundation`) |
| Linux    | V4L2 (`-f v4l2 -i /dev/video0`)  |
| Windows  | DirectShow (`-f dshow`)          |

ffmpeg always captures at 640x480/30fps from the device and downscales to 160x48 for the ASCII grid. The 160-column width is intentional — ASCII characters are taller than wide, so this keeps the aspect ratio roughly square.

## Key Files

| File                   | What it does                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/main.ts`          | Entry point — spawns worker, sets up postal transport, renders frames, handles keyboard input and HUD     |
| `src/camera-worker.ts` | Spawns ffmpeg, buffers RGB24 stdout into frames, converts to ASCII, publishes on `camera` channel         |
| `src/ascii.ts`         | RGB→luminance→character mapping; mono and color frame builders with quantization and escape deduplication |
| `src/ansi.ts`          | ANSI escape sequence utilities (alternate screen, cursor, truecolor SGR)                                  |
| `src/types.ts`         | Shared `FramePayload`, `ControlPayload`, and `StatusPayload` types                                        |

## What This Demonstrates (postal features)

- **MessagePort transport** — connecting two postal instances across `worker_threads` using `connectToWorkerThread` / `connectFromWorkerThread`
- **Channel-scoped pub/sub** — all messaging goes through the `camera` channel, keeping topics namespaced and subscriptions tidy
- **Bidirectional messaging** — frames flow worker→main, controls flow main→worker, over the same transport
- **Wiretap as an observability hook** — FPS counting without touching the frame subscription or the worker
