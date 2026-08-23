# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

YAVA (yet another video app) is a browser-based video editor and recorder built on FFmpeg compiled to WebAssembly. Everything runs client-side, nothing is uploaded. Live at www.yava.video (Vercel).

Users import a video (file, URL, camera, screen capture), then trim, slice into segments, crop, resize, change speed, and export to mp4/mov/webm/gif.

## Commands

- `npm run dev` — Vite dev server on https://localhost:3000 (self-signed cert via `@vitejs/plugin-basic-ssl`)
- `npm run build` — `tsc -b` then Vite production build
- `npm run check` — typecheck + Prettier check + ESLint. Run this before calling work done.
- `npm run format` — Prettier write over `src/**`
- `npm run test` — all three suites in sequence

### Tests

Three separate runners, three separate configs:

| Suite                     | Command             | Config                     | Location                      |
| ------------------------- | ------------------- | -------------------------- | ----------------------------- |
| Unit (jsdom)              | `npm run test:unit` | `vitest.config.ts`         | `src/**/*.test.ts`            |
| Component (Playwright CT) | `npm run test:ct`   | `playwright-ct.config.ts`  | `tests/components/*.spec.tsx` |
| End-to-end                | `npm run test:e2e`  | `playwright-e2e.config.ts` | `tests/e2e/*.spec.ts`         |

Single test:

```bash
npx vitest run src/store.test.ts -t "sliceAtCursor"
npx playwright test -c playwright-ct.config.ts tests/components/VideoTimeline.spec.tsx
npx playwright test -c playwright-e2e.config.ts -g "hash URL round-trip"
```

The e2e suite starts the dev server itself (`reuseExistingServer: true`) and downloads a real sample video over the network, so it needs connectivity and is slower than the rest.

## Architecture

### Segments are the source of truth

`src/store.tsx` holds a `Segment[]` (each `{id, sourceStart, sourceEnd}`, sorted, non-overlapping). Trimming, slicing, and deleting are all segment operations.

`cursorStart` and `cursorEnd` are cached mirrors of `segments[0].sourceStart` and the last segment's `sourceEnd`. They have no setters. Every segment mutation recomputes them, and the cursor snaps to the nearest boundary if it lands in a gap. To move a trim edge, call `updateSegmentBounds`, never assign the cursors. Single-segment mode in `TrimPanel` is just editing `segments[0]`.

Deleting a middle segment leaves a gap in source time. Playback skips gaps and export concatenates around them, so segments do not have to be contiguous.

### Bootstrap order

Nothing in the editor exists until video metadata is available, and the chain matters:

1. `NewVideo` calls `setFile(blob, sourceUrl?)`
2. `App` swaps to the editor, which mounts `VideoPlayer`
3. `onLoadedData` fires and `setVideo(el)` stores the element
4. `App` now renders the timeline; `VideoTimeline`'s effect calls `resetCursors(video.duration)`
5. `resetCursors` builds the default full-duration segment and, if `pendingEditState` is set, overlays the URL-restored state

So restored share links land in `resetCursors`, not at file load. That is also why `resetCursors` doubles as the panels' "Reset" action.

### URL state sync

`src/lib/url-state.ts` is imported for side effects in `App.tsx`. Two directions:

**Writing.** A module-level `useAppStore.subscribe` debounces 500ms, encodes non-default state as base64url JSON, and writes it to the hash with `history.replaceState`. Only values that differ from the defaults are encoded, so a fresh load has no hash at all.

**Reading.** `parseUrlEditState()` runs at module scope in `NewVideo.tsx`. It reads `?v=` (explicit video URL, takes priority over the hash's `v`), strips `?v=` once consumed, and decodes the hash into `pendingEditState`. The `fetch` also starts at module scope so React StrictMode's double-mount does not fetch twice.

Adding a shareable field means touching four places: the `UrlEditState` type and `buildEditStateUpdates` in `store.tsx`, plus `encodeEditState` and `decodeEditState` in `url-state.ts`. `decodeEditState` validates every field by type and swallows malformed input, since hashes come from untrusted URLs.

### FFmpeg

One `FFmpeg` instance lives in the store, unloaded until first export. `useFFmpeg` fetches the core from unpkg (`@ffmpeg/core@0.12.6`, or `core-mt` when multithreading is available) and reports per-file download progress against hardcoded byte sizes in `FILE_SIZES`. They are hardcoded because unpkg serves these chunked with no `Content-Length`, so `@ffmpeg/util` reports `total: -1` and cannot compute progress itself. The two builds differ in size, so re-measure both sets when bumping the version.

Multithreading requires `crossOriginIsolated`, which requires COOP/COEP headers. `vite.config.ts` sets them for the dev server and `vercel.json` sets them in production. Both use `COEP: credentialless` rather than `require-corp`, because `index.html` pulls in gtag.js and the Google Fonts stylesheet in no-cors mode and neither origin sends `Cross-Origin-Resource-Policy`, which `require-corp` would demand. `credentialless` is Chromium-only; Safari parses the unrecognized value as `unsafe-none` and falls back to the single-threaded core. Any new cross-origin subresource in `index.html` needs a check that it survives COEP.

### Export pipeline

`VideoExportDialog.tsx` is the whole command builder. Filter order is deliberate:

1. `scale=<intrinsic w>:<intrinsic h>` first when cropping, to normalize non-square SAR before crop coordinates are applied
2. `crop=w:h:x:y`, computed from the fractional crop rect against intrinsic dimensions
3. output `scale`, with `-2` for "keep aspect" on either axis
4. `setpts` for speed, plus chained `atempo` on audio (2.0 or 0.5 steps, since a single `atempo` only covers 0.5 to 2.0)

Widths and heights are rounded down to even numbers because x264 requires it. Codec choice: mp4/mov use x264 `-preset`, webm uses libvpx with `-deadline`/`-cpu-used` mapped from the same preset names, gif is native. Audio is `-c:a copy` only when no audio filter is active.

One segment runs a single `exec`. Multiple segments extract each to `segment_N.<fmt>`, write a `concat_list.txt`, then run the concat demuxer with `-c copy`, and clean up the intermediates. Files are deleted from the WASM filesystem after every export to keep memory from growing.

### Segment-aware playback

`VideoPlayer`'s `onTimeUpdate` handler is the playback engine. It finds the segment containing `currentTime`, jumps to the next segment's start on reaching a segment end, pauses at the last segment's end, and seeks forward out of gaps. Single-segment videos take a simpler path that just clamps to `cursorStart`/`cursorEnd`.

### Shared tolerances

`src/lib/utils.ts` exports named epsilons: `MIN_SLICE_DISTANCE` (0.5s minimum segment length), `FLUSH_TOLERANCE` (0.01s, treats boundaries as touching so segments can be joined), `PLAYBACK_TOLERANCE` (0.05s), `RESTART_TOLERANCE` (0.1s). Reuse them along with `findSegmentAt`, `findSegmentIndexAt`, and `snapToNearestSegmentBoundary` instead of inlining new comparisons.

## Test setup

Both Vitest and Playwright CT alias `@ffmpeg/ffmpeg` to `src/__mocks__/@ffmpeg/ffmpeg.ts` (an empty `FFmpeg` class). Without it the store constructor drags in WASM.

Component tests seed the store rather than driving the UI from an empty state. `playwright/index.tsx` registers a `beforeMount` hook that applies `hooksConfig.storeState` via `useAppStore.setState`, and `tests/helpers.ts` exports `withStore(overrides)` to build that config against a 60-second fake video. A `Blob` cannot be serialized from Node to the browser, so pass `file: true` and the hook constructs a real Blob.

E2E tests wait on the "Start Over" button as the editor-ready signal, and poll `page.url()` for hash changes because of the 500ms sync debounce.

## Conventions

- Path alias `@` maps to `./src`, declared in `tsconfig.app.json`, `vite.config.ts`, `vitest.config.ts`, and `playwright-ct.config.ts`. Keep them in sync.
- Tailwind 4 config lives in `src/index.css` under `@theme inline`. There is no `tailwind.config.js`. Colors are HSL custom properties, dark theme only, no light mode.
- `src/components/ui/` is shadcn/ui output managed by the CLI (`components.json`: default style, slate base). Do not hand-edit.
- Hot components (`VideoTimeline`, `SliceToolbar`) select from the store with `useShallow` to avoid re-rendering on unrelated changes. Follow that in anything that reads several keys and runs on pointer move.
- ESLint flat config turns off three React Compiler rules (`preserve-manual-memoization`, `set-state-in-effect`, `immutability`) that the codebase does not satisfy yet. Do not re-enable them for a local fix.
- Icons come from `lucide-react`. Vite env access uses `import.meta.env.DEV`.
- Prettier defaults, enforced by `npm run check`.
