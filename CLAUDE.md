# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YAVA (Yet Another Video App) is a browser-based video editor/recorder that uses FFmpeg compiled to WebAssembly. All video processing happens client-side — no server uploads. Live at yetanothervideo.app.

## Commands

- `npm run dev` — Start Vite dev server (HTTPS on localhost:3000)
- `npm run build` — Type-check with `tsc -b` then Vite production build
- `npm run lint` — ESLint across the project
- `npm run preview` — Serve production build locally

No test runner is configured.

## Architecture

**Stack:** React 19 + TypeScript 5.9, Vite 8, Tailwind CSS 4, shadcn/ui (Radix), Zustand 5, FFmpeg WASM.

**State management:** Single Zustand store in `src/store.tsx` holds all app state — FFmpeg instance, video file/element, cursor positions (playback, trim start/end), crop rectangle, and processing flag.

**FFmpeg integration:** `src/hooks/useFFmpeg.ts` lazy-loads FFmpeg WASM core from CDN. The export dialog (`src/components/export/VideoExportDialog.tsx`) constructs FFmpeg commands with scale/crop/framerate filters and writes output as a downloadable Blob.

**Component layout:**
- `App.tsx` — Root: shows `NewVideo` (upload/record) when no file loaded, or the editor UI (player + timeline + export options) when a file is present.
- `components/player/` — `VideoPlayer` (video element + canvas crop overlay + controls)
- `components/timeline/` — `VideoTimeline` (trim handles + scrubber) and `VideoThumbnails`
- `components/export/` — Export dialog and options (format, dimensions, framerate, audio)
- `components/ui/` — shadcn/ui primitives (do not edit manually; managed by shadcn CLI)

**WASM requirements:** The app needs `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers for SharedArrayBuffer (FFmpeg multithreading). These are set in `vite.config.ts`.

**Path alias:** `@` maps to `./src` (configured in `tsconfig.app.json` and `vite.config.ts` via `import.meta.dirname`).

## Key Conventions

- shadcn/ui config is in `components.json` (style: default, base color: slate, CSS variables enabled)
- Tailwind 4 config lives in CSS (`src/index.css`) using `@theme inline` — there is no `tailwind.config.js`
- PostCSS uses `@tailwindcss/postcss` (no autoprefixer needed — built into TW4)
- Tailwind theme uses HSL CSS custom properties for colors (defined in `src/index.css`)
- Icons from `lucide-react`
- ESLint uses flat config (`eslint.config.js`); React Compiler rules are disabled
- TypeScript targets ES2022 with ES2023 lib (enables `findLast`, etc.)
- Vite env: use `import.meta.env.DEV` (not `process.env.NODE_ENV`)
