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

The e2e suite starts the dev server itself (`reuseExistingServer: true`) and serves `tests/fixtures/tiny.mp4` from a routed, unroutable host, so it never touches the network.

`tests/e2e/export.spec.ts` is the exception. Its two real-FFmpeg tests pull the ~32MB WASM core from unpkg and are skipped unless `YAVA_E2E_FFMPEG=1` is set:

```bash
YAVA_E2E_FFMPEG=1 npx playwright test -c playwright-e2e.config.ts tests/e2e/export.spec.ts
```

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

One `FFmpeg` instance lives in the store, unloaded until first export. `useFFmpeg` fetches the core from unpkg (`@ffmpeg/core@0.12.10`, or `core-mt` when multithreading is available) and reports per-file download progress against hardcoded byte sizes in `FILE_SIZES`. They are hardcoded because unpkg serves these chunked with no `Content-Length`, so `@ffmpeg/util` reports `total: -1` and cannot compute progress itself. The two builds differ in size, so re-measure both sets when bumping the version.

`loadCore` in `src/lib/load-core.ts` does the fetching and keeps one load per
FFmpeg instance in a `WeakMap`, so concurrent callers share it rather than each
pulling 32MB. Keyed on the instance, not a module flag, so a load after
`terminate()` still works. `toBlobURL` is injected, which is what makes the
progress arithmetic and the deduplication testable without the network.

Multithreading requires `crossOriginIsolated`, which requires COOP/COEP headers. `vite.config.ts` sets them for the dev server and `vercel.json` sets them in production. Both use `COEP: credentialless` rather than `require-corp`, because `index.html` pulls in gtag.js and the Google Fonts stylesheet in no-cors mode and neither origin sends `Cross-Origin-Resource-Policy`, which `require-corp` would demand. `credentialless` is Chromium-only; Safari parses the unrecognized value as `unsafe-none` and falls back to the single-threaded core. Any new cross-origin subresource in `index.html` needs a check that it survives COEP.

### Export pipeline

`src/lib/export-command.ts` builds every argument list and `src/lib/export-run.ts` runs them. The dialog only wires the store to those two and renders progress, so both are testable without React. Filter order is deliberate:

1. `scale=<intrinsic w>:<intrinsic h>` first when cropping, to normalize non-square SAR before crop coordinates are applied
2. `crop=w:h:x:y`, computed from the fractional crop rect against intrinsic dimensions
3. output `scale`, resolved to two concrete even numbers by `effectiveOutputSize`
4. `setpts` for speed, plus chained `atempo` on audio (2.0 or 0.5 steps, since a single `atempo` only covers 0.5 to 2.0)

Widths and heights are rounded down to even numbers because x264 requires it. Codec choice: mp4/mov use x264 `-preset`, webm uses libvpx with `-deadline`/`-cpu-used` mapped from the same preset names, gif is native. Audio is `-c:a copy` only when no audio filter is active.

`effectiveOutputSize` answers what size an export will be, from the crop rect, the source and the two override fields. `buildVideoFilters` calls it, and so does the export panel, so the number on screen is the number that comes out and there is no second resolution to keep in step. Blank fields mean "work it out"; setting one axis and leaving the other blank keeps the aspect ratio, which is why the blank axis resolves to a real number here rather than being left to ffmpeg's `-2`. Nothing writes derived dimensions back into the store: doing that cost two store writes per pointer move during a crop drag.

Every format except gif pins `-pix_fmt yuv420p`. Without it the encoder inherits the source's pixel format, and a 10-bit source (any iPhone HDR clip) yields H.264 High 10, which browsers do not decode: the file plays in QuickTime but shows up black in the editor and in the export preview. The colour tags are left alone, so HDR sources still export with BT.2020/HLG metadata on an 8-bit signal.

8-bit is not a preference, it is the only portable output this core can make. Measured in the browser against both `0.12.6` and `0.12.10`, which behave identically here: `libvpx-vp9` is present but unusable, failing with `memory access out of bounds` or hanging on 15 frames of 160x120, and 10-bit VP9 is refused outright with "Profile > 1 not supported in this build configuration". `libx265` does encode Main 10, but plain Chromium cannot decode the result, so it would only play on Apple platforms. Do not spend time trying to preserve 10 bits without first replacing the core.

The 0.12.7 release notes claim `--enable-libzimg`, but `zscale` aborts the wasm module in both the st and mt builds, which rules out the usual HDR tone-mapping chain. `tonemap` on its own does run. Nothing short of a custom core build changes any of this.

One segment runs a single `exec`. Multiple segments extract each to `segment_N.<fmt>`, write a `concat_list.txt`, then run the concat demuxer with `-c copy`. `runExport` owns every name it writes inside the WASM filesystem and deletes them all in a `finally`, so a failed run leaks nothing.

`ffmpeg.exec` resolves with an exit code instead of rejecting, so `runExport` checks it and throws a message naming the step that broke. The dialog catches that and shows "Export Failed", except when the failure came from the user closing the dialog, which terminates FFmpeg on purpose.

### When a video will not decode

Two different failures, handled separately. If the element raises an error, `describeMediaError` turns the code into a message; Chromium fires that with a null `MediaError` for a codec it cannot use, so a missing code is read as an unsupported codec rather than something generic.

The harder case raises nothing at all. A file whose video track the browser cannot decode but whose audio track it can will report metadata, reach readyState 4 and fire `loadeddata`, so the editor opens on a player that never produces a frame and a timeline with no thumbnails. `VideoPlayer` waits `FRAME_CHECK_MS` after `loadeddata` and checks `getVideoPlaybackQuality().totalVideoFrames`, which a working source fills within ~200ms. Export still works in that state, since FFmpeg brings its own decoders, and the message says so. `requestVideoFrameCallback` is no use here: it never fires for a paused video, working or not.

### Pointer maths lives in lib

`src/lib/crop.ts` and `src/lib/timeline.ts` hold the geometry the canvas and the
timeline used to compute inline: corner hit-testing, drag anchors, clamping a
moved rectangle or segment against its bounds and neighbours, and reproportioning
a crop when the player is resized. The components keep the refs, the drawing and
the event wiring. Both modules take plain numbers so the edges are unit-testable,
which is where the guards against dividing by an unmeasured track width or
reference box are asserted.

`CropRectangle` lives in `src/lib/crop.ts`, not in the canvas component, so the
store and the export builder do not import a type from a component. `cropToSource`
is the one conversion from the player's displayed pixels to the source's
intrinsic ones, shared by the crop panel's inputs and both export builders.

`draggedSegmentBounds` takes the segment's position when the drag started, not
its current one, because the pointer delta is measured from the pointer's own
start. Feeding the live position back in re-applies the whole delta per move and
the segment runs away.

### Segment-aware playback

`VideoPlayer`'s `onTimeUpdate` handler is the playback engine, and every decision it makes comes from `nextPlaybackAction` in `src/lib/playback.ts`. That function takes the segments and the current time and returns `continue`, `seek`, or `stop`: seek forward out of a gap or back to the first segment, stop at the last segment's end, otherwise keep rolling. There is no separate single-segment path.

A time on a cut shared by two flush segments resolves to the later segment, so playback runs straight through the cut. Resolving it to the earlier one instead would end that segment and seek to the timestamp the playhead already holds, and the seek's own `timeupdate` would repeat the decision forever. The handler also skips any seek shorter than `SEEK_TOLERANCE` for the same reason.

### Shared tolerances

`src/lib/utils.ts` exports named epsilons: `MIN_SLICE_DISTANCE` (0.5s minimum segment length), `FLUSH_TOLERANCE` (0.01s, treats boundaries as touching so segments can be joined), `PLAYBACK_TOLERANCE` (0.05s), `SEEK_TOLERANCE` (0.01s, below which a seek is a no-op and gets skipped), `RESTART_TOLERANCE` (0.1s). Reuse them along with `findSegmentAt` and `snapToNearestSegmentBoundary` instead of inlining new comparisons.

`findSegmentAt` resolves a time on a shared cut to the earlier segment, which suits the timeline and the store. `nextPlaybackAction` needs the later one and so runs its own scan; that is the one place a separate lookup is right.

## Test setup

Both Vitest and Playwright CT alias `@ffmpeg/ffmpeg` to `src/__mocks__/@ffmpeg/ffmpeg.ts` (an empty `FFmpeg` class). Without it the store constructor drags in WASM.

Component tests seed the store rather than driving the UI from an empty state. `playwright/index.tsx` registers a `beforeMount` hook that applies `hooksConfig.storeState` via `useAppStore.setState`, and `tests/helpers.ts` exports `withStore(overrides)` to build that config against a 60-second fake video. A `Blob` cannot be serialized from Node to the browser, so pass `file: true` and the hook constructs a real Blob.

E2E tests wait on the "Start Over" button as the editor-ready signal, and poll `page.url()` for hash changes because of the 500ms sync debounce.

## Conventions

- Path alias `@` maps to `./src`, declared in `tsconfig.app.json`, `vite.config.ts`, `vitest.config.ts`, and `playwright-ct.config.ts`. Keep them in sync.
- Tailwind 4 config lives in `src/index.css` under `@theme inline`. There is no `tailwind.config.js`. Colors are HSL custom properties, dark theme only, no light mode.
- `src/components/ui/` is shadcn/ui output managed by the CLI (`components.json`: default style, slate base). Do not hand-edit.
- Every control needs an accessible name, and `tests/e2e/accessible-names.spec.ts` fails if one does not have it. Icon-only buttons carry `aria-label`; inputs get an id from `useId` and a label pointing at it, which also keeps the ids unique, since both the desktop and mobile layouts mount every panel. The two `Slider` thumbs are the one exception: Radix renders them inside the primitive and `src/components/ui` is not hand-edited. Playwright matches accessible names by substring, so `{ exact: true }` matters when one name contains another.
- Never subscribe with a bare `useAppStore()`. Zustand rebuilds state on every `set`, so a selectorless component re-renders on every store write. Select with `useShallow` for several keys, or `useAppStore((s) => s.thing)` for one. This matters most in `App`: it renders the whole editor, and nothing below it can opt out of a re-render while it re-renders, so a selectorless `App` defeats every child's selector. Read one-shot values inside a handler with `useAppStore.getState()` instead of subscribing.
- ESLint flat config turns off three React Compiler rules (`preserve-manual-memoization`, `set-state-in-effect`, `immutability`) that the codebase does not satisfy yet. Do not re-enable them for a local fix.
- Icons come from `lucide-react`. Vite env access uses `import.meta.env.DEV`.
- Prettier defaults, enforced by `npm run check`.
