import { create } from "zustand";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { CropRectangle, EMPTY_CROP } from "./lib/crop";
import { supportsMultithreading } from "./hooks/useFFmpeg";
import { clampFades, fadeIntent, withFade, type FadeKind } from "./lib/fade";
import {
  clamp,
  findSegmentAt,
  snapToNearestSegmentBoundary,
  MIN_SLICE_DISTANCE,
  FLUSH_TOLERANCE,
  type SegmentLike,
} from "./lib/utils";

export type Format = "mp4" | "webm" | "mov" | "gif";
export type Preset = "ultrafast" | "fast" | "medium" | "slow";

export interface Segment extends SegmentLike {
  id: string;
}

/** `[start, end]`, plus both fade lengths once either one is set. */
export type UrlSegment = [number, number, number?, number?];

export interface UrlEditState {
  v?: string;
  seg?: UrlSegment[];
  fmt?: Format;
  pre?: Preset;
  fps?: number;
  spd?: number;
  na?: boolean;
}

interface AppState {
  ffmpeg: FFmpeg;
  multithreading: boolean;

  file?: Blob;
  video: HTMLVideoElement;
  sourceUrl: string | null;

  cursorCurrent: number;
  cursorStart: number;
  cursorEnd: number;
  cropRectangle: CropRectangle;

  segments: Segment[];
  selectedSegmentId: string | null;
  nextSegmentId: number;

  processing: boolean;

  pendingEditState: UrlEditState | null;

  format: Format;
  preset: Preset;
  frameRate: number;
  speed: number;
  outputWidth: string;
  outputHeight: string;
  noAudio: boolean;
}

interface AppActions {
  setMultithreading: (multithreading: boolean) => void;

  setVideo: (video: HTMLVideoElement) => void;
  setFile: (file: Blob, sourceUrl?: string) => void;

  setCursorCurrent: (cursorCurrent: number) => void;
  setCropRectangle: (cropRectangle: CropRectangle) => void;

  resetCursors: (duration: number) => void;
  setProcessing: (processing: boolean) => void;

  sliceAtCursor: () => void;
  fadeAtCursor: (kind: FadeKind) => void;
  deleteSegment: (id: string) => void;
  joinSegment: (id: string) => void;
  selectSegment: (id: string | null) => void;
  updateSegmentBounds: (
    id: string,
    sourceStart: number,
    sourceEnd: number,
  ) => void;

  setFormat: (format: Format) => void;
  setPreset: (preset: Preset) => void;
  setFrameRate: (frameRate: number) => void;
  setSpeed: (speed: number) => void;
  setOutputWidth: (outputWidth: string) => void;
  setOutputHeight: (outputHeight: string) => void;
  setNoAudio: (noAudio: boolean) => void;
  resetExportOptions: () => void;

  reset: () => void;
}

export const DEFAULT_EXPORT = {
  format: "mp4" as Format,
  preset: "ultrafast" as Preset,
  frameRate: 30,
  speed: 1,
  outputWidth: "",
  outputHeight: "",
  noAudio: false,
};

function buildEditStateUpdates(
  editState: UrlEditState,
  duration: number,
): Partial<AppState> | null {
  const updates: Partial<AppState> = {};

  if (editState.seg?.length) {
    const segments: Segment[] = [];
    let nextId = 0;
    for (const [start, end, fadeIn, fadeOut] of editState.seg) {
      const s = clamp(start, duration);
      const e = clamp(end, duration);
      if (e - s >= MIN_SLICE_DISTANCE) {
        segments.push(
          clampFades({
            id: `s${nextId++}`,
            sourceStart: s,
            sourceEnd: e,
            fadeIn,
            fadeOut,
          }),
        );
      }
    }
    if (segments.length > 0) {
      segments.sort((a, b) => a.sourceStart - b.sourceStart);
      updates.segments = segments;
      updates.nextSegmentId = nextId;
      updates.cursorStart = segments[0].sourceStart;
      updates.cursorEnd = segments[segments.length - 1].sourceEnd;
      updates.cursorCurrent = segments[0].sourceStart;
      updates.selectedSegmentId = null;
    }
  }

  if (editState.fmt) updates.format = editState.fmt;
  if (editState.pre) updates.preset = editState.pre;
  if (editState.fps != null) updates.frameRate = editState.fps;
  if (editState.spd != null) updates.speed = editState.spd;
  if (editState.na != null) updates.noAudio = editState.na;

  return Object.keys(updates).length > 0 ? updates : null;
}

export const useAppStore = create<AppState & AppActions>()((set) => ({
  ffmpeg: new FFmpeg(),
  multithreading: supportsMultithreading,

  video: undefined!,
  file: undefined,
  sourceUrl: null,

  cursorCurrent: 0,
  cursorStart: 0,
  cursorEnd: 0,
  cropRectangle: EMPTY_CROP,

  segments: [],
  selectedSegmentId: null,
  nextSegmentId: 0,

  processing: false,

  pendingEditState: null,

  ...DEFAULT_EXPORT,

  setMultithreading: (multithreading: boolean) =>
    set(() => ({ multithreading })),

  setVideo: (video) => set(() => ({ video })),
  setFile: (file, sourceUrl) =>
    set(() => ({ file, sourceUrl: sourceUrl ?? null })),

  setCursorCurrent: (cursorCurrent) => set(() => ({ cursorCurrent })),
  setCropRectangle: (cropRectangle) => set(() => ({ cropRectangle })),

  resetCursors: (duration) =>
    set((state) => {
      const defaults = {
        cursorStart: 0,
        cursorEnd: duration,
        cursorCurrent: 0,
        segments: [
          { id: "s0", sourceStart: 0, sourceEnd: duration },
        ] as Segment[],
        selectedSegmentId: null as string | null,
        nextSegmentId: 1,
      };
      const editState = state.pendingEditState;
      if (!editState) return defaults;
      const edits = buildEditStateUpdates(editState, duration);
      return edits ? { ...defaults, ...edits } : defaults;
    }),

  setProcessing: (processing) => set(() => ({ processing })),

  sliceAtCursor: () =>
    set((state) => {
      const { cursorCurrent, segments, nextSegmentId } = state;
      const idx = segments.findIndex(
        (s) =>
          cursorCurrent > s.sourceStart + MIN_SLICE_DISTANCE &&
          cursorCurrent < s.sourceEnd - MIN_SLICE_DISTANCE,
      );
      if (idx === -1) return state;

      const seg = segments[idx];
      const left: Segment = clampFades({
        id: `s${nextSegmentId}`,
        sourceStart: seg.sourceStart,
        sourceEnd: cursorCurrent,
        fadeIn: seg.fadeIn,
      });
      const right: Segment = clampFades({
        id: `s${nextSegmentId + 1}`,
        sourceStart: cursorCurrent,
        sourceEnd: seg.sourceEnd,
        fadeOut: seg.fadeOut,
      });

      const newSegments = [...segments];
      newSegments.splice(idx, 1, left, right);

      return {
        segments: newSegments,
        nextSegmentId: nextSegmentId + 2,
        selectedSegmentId: null,
      };
    }),

  fadeAtCursor: (kind) =>
    set((state) => {
      const intent = fadeIntent(state.segments, state.cursorCurrent, kind);
      if (!intent) return state;

      const segments = [...state.segments];
      segments[intent.index] = withFade(
        segments[intent.index],
        kind,
        intent.duration,
      );

      return { segments };
    }),

  deleteSegment: (id) =>
    set((state) => {
      if (state.segments.length <= 1) return state;

      const newSegments = state.segments.filter((s) => s.id !== id);
      if (newSegments.length === state.segments.length) return state;

      const newStart = newSegments[0].sourceStart;
      const newEnd = newSegments[newSegments.length - 1].sourceEnd;

      // Snap cursor if it was inside the deleted segment
      let { cursorCurrent } = state;
      if (!findSegmentAt(newSegments, cursorCurrent)) {
        cursorCurrent = snapToNearestSegmentBoundary(
          newSegments,
          cursorCurrent,
          newStart,
        );
      }

      return {
        segments: newSegments,
        cursorStart: newStart,
        cursorEnd: newEnd,
        cursorCurrent,
        selectedSegmentId: null,
      };
    }),

  joinSegment: (id) =>
    set((state) => {
      const idx = state.segments.findIndex((s) => s.id === id);
      if (idx === -1) return state;

      // Walk left to find all flush neighbors
      let startIdx = idx;
      while (startIdx > 0) {
        const prev = state.segments[startIdx - 1];
        const curr = state.segments[startIdx];
        if (Math.abs(prev.sourceEnd - curr.sourceStart) <= FLUSH_TOLERANCE) {
          startIdx--;
        } else {
          break;
        }
      }

      // Walk right to find all flush neighbors
      let endIdx = idx;
      while (endIdx < state.segments.length - 1) {
        const curr = state.segments[endIdx];
        const next = state.segments[endIdx + 1];
        if (Math.abs(curr.sourceEnd - next.sourceStart) <= FLUSH_TOLERANCE) {
          endIdx++;
        } else {
          break;
        }
      }

      // Nothing to join if it's just the one segment
      if (startIdx === endIdx) return state;

      const merged: Segment = clampFades({
        id: `s${state.nextSegmentId}`,
        sourceStart: state.segments[startIdx].sourceStart,
        sourceEnd: state.segments[endIdx].sourceEnd,
        fadeIn: state.segments[startIdx].fadeIn,
        fadeOut: state.segments[endIdx].fadeOut,
      });

      const newSegments = [
        ...state.segments.slice(0, startIdx),
        merged,
        ...state.segments.slice(endIdx + 1),
      ];

      return {
        segments: newSegments,
        nextSegmentId: state.nextSegmentId + 1,
        cursorStart: newSegments[0].sourceStart,
        cursorEnd: newSegments[newSegments.length - 1].sourceEnd,
        selectedSegmentId: merged.id,
      };
    }),

  selectSegment: (id) => set(() => ({ selectedSegmentId: id })),

  updateSegmentBounds: (id, sourceStart, sourceEnd) =>
    set((state) => {
      const idx = state.segments.findIndex((s) => s.id === id);
      if (idx === -1) return state;

      sourceStart = Math.max(0, sourceStart);
      sourceEnd = Math.min(state.video?.duration ?? Infinity, sourceEnd);

      if (sourceEnd - sourceStart < MIN_SLICE_DISTANCE) return state;

      const prev = state.segments[idx - 1];
      const next = state.segments[idx + 1];
      if (prev && sourceStart < prev.sourceEnd) sourceStart = prev.sourceEnd;
      if (next && sourceEnd > next.sourceStart) sourceEnd = next.sourceStart;

      const segments = [...state.segments];
      segments[idx] = clampFades({ ...segments[idx], sourceStart, sourceEnd });

      const cursorStart = segments[0].sourceStart;
      const cursorEnd = segments[segments.length - 1].sourceEnd;

      let { cursorCurrent } = state;
      if (!findSegmentAt(segments, cursorCurrent)) {
        cursorCurrent = snapToNearestSegmentBoundary(
          segments,
          cursorCurrent,
          cursorStart,
        );
      }

      return { segments, cursorStart, cursorEnd, cursorCurrent };
    }),

  setFormat: (format) => set(() => ({ format })),
  setPreset: (preset) => set(() => ({ preset })),
  setFrameRate: (frameRate) => set(() => ({ frameRate })),
  setSpeed: (speed) => set(() => ({ speed })),
  setOutputWidth: (outputWidth) => set(() => ({ outputWidth })),
  setOutputHeight: (outputHeight) => set(() => ({ outputHeight })),
  setNoAudio: (noAudio) => set(() => ({ noAudio })),
  resetExportOptions: () =>
    set(() => ({
      ...DEFAULT_EXPORT,
      cropRectangle: EMPTY_CROP,
    })),

  reset: () => {
    window.history.replaceState({}, "", window.location.pathname);
    set(() => ({
      multithreading: supportsMultithreading,

      file: undefined!,
      video: undefined!,
      sourceUrl: null,

      cursorCurrent: 0,
      cursorStart: 0,
      cursorEnd: 0,
      cropRectangle: EMPTY_CROP,

      segments: [],
      selectedSegmentId: null,
      nextSegmentId: 0,

      processing: false,

      pendingEditState: null,

      ...DEFAULT_EXPORT,
    }));
  },
}));
