import { create } from "zustand";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { CropRectangle } from "./components/player/VideoCanvas";
import { supportsMultithreading } from "./hooks/useFFmpeg";
import {
  findSegmentAt,
  snapToNearestSegmentBoundary,
  MIN_SLICE_DISTANCE,
} from "./lib/utils";

export type Format = "mp4" | "webm" | "mov" | "gif";
export type Preset = "ultrafast" | "fast" | "medium" | "slow";

export interface Segment {
  id: string;
  sourceStart: number;
  sourceEnd: number;
}

interface AppState {
  ffmpeg: FFmpeg;
  multithreading: boolean;

  file?: Blob;
  video: HTMLVideoElement;

  cursorCurrent: number;
  cursorStart: number;
  cursorEnd: number;
  cropRectangle: CropRectangle;

  segments: Segment[];
  selectedSegmentId: string | null;
  nextSegmentId: number;

  processing: boolean;

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
  setFile: (file: Blob) => void;

  setCursorCurrent: (cursorCurrent: number) => void;
  setCursorStart: (cursorStart: number) => void;
  setCursorEnd: (cursorEnd: number) => void;
  setCropRectangle: (cropRectangle: CropRectangle) => void;

  resetCursors: (duration: number) => void;
  setProcessing: (processing: boolean) => void;

  sliceAtCursor: () => void;
  deleteSegment: (id: string) => void;
  selectSegment: (id: string | null) => void;

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

const DEFAULT_EXPORT = {
  format: "mp4" as Format,
  preset: "ultrafast" as Preset,
  frameRate: 30,
  speed: 1,
  outputWidth: "",
  outputHeight: "",
  noAudio: false,
};

export const useAppStore = create<AppState & AppActions>()((set, get) => ({
  ffmpeg: new FFmpeg(),
  multithreading: supportsMultithreading,

  video: undefined!,
  file: undefined,

  cursorCurrent: 0,
  cursorStart: 0,
  cursorEnd: 0,
  cropRectangle: {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    vw: 0,
    vh: 0,
  },

  segments: [],
  selectedSegmentId: null,
  nextSegmentId: 0,

  processing: false,

  ...DEFAULT_EXPORT,

  setMultithreading: (multithreading: boolean) =>
    set(() => ({ multithreading })),

  setVideo: (video) => set(() => ({ video })),
  setFile: (file) => set(() => ({ file })),

  setCursorCurrent: (cursorCurrent) => set(() => ({ cursorCurrent })),
  setCursorStart: (cursorStart) =>
    set((state) => {
      const segments = [...state.segments];
      if (segments[0]) {
        segments[0] = { ...segments[0], sourceStart: cursorStart };
      }
      return {
        cursorStart,
        cursorCurrent: Math.max(state.cursorCurrent, cursorStart),
        segments,
      };
    }),
  setCursorEnd: (cursorEnd) =>
    set((state) => {
      const last = state.segments.length - 1;
      const segments = [...state.segments];
      if (segments[last]) {
        segments[last] = { ...segments[last], sourceEnd: cursorEnd };
      }
      return {
        cursorEnd,
        cursorCurrent: Math.min(state.cursorCurrent, cursorEnd),
        segments,
      };
    }),
  setCropRectangle: (cropRectangle) => set(() => ({ cropRectangle })),

  resetCursors: (duration) =>
    set(() => ({
      cursorStart: 0,
      cursorEnd: duration,
      cursorCurrent: 0,
      segments: [{ id: "s0", sourceStart: 0, sourceEnd: duration }],
      selectedSegmentId: null,
      nextSegmentId: 1,
    })),

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
      const left: Segment = {
        id: `s${nextSegmentId}`,
        sourceStart: seg.sourceStart,
        sourceEnd: cursorCurrent,
      };
      const right: Segment = {
        id: `s${nextSegmentId + 1}`,
        sourceStart: cursorCurrent,
        sourceEnd: seg.sourceEnd,
      };

      const newSegments = [...segments];
      newSegments.splice(idx, 1, left, right);

      return {
        segments: newSegments,
        nextSegmentId: nextSegmentId + 2,
        selectedSegmentId: null,
      };
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

  selectSegment: (id) => set(() => ({ selectedSegmentId: id })),

  setFormat: (format) => set(() => ({ format })),
  setPreset: (preset) => set(() => ({ preset })),
  setFrameRate: (frameRate) => set(() => ({ frameRate })),
  setSpeed: (speed) => set(() => ({ speed })),
  setOutputWidth: (outputWidth) => set(() => ({ outputWidth })),
  setOutputHeight: (outputHeight) => set(() => ({ outputHeight })),
  setNoAudio: (noAudio) => set(() => ({ noAudio })),
  resetExportOptions: () => {
    const { video } = get();
    set(() => ({
      ...DEFAULT_EXPORT,
      outputWidth: video ? String(video.videoWidth) : "",
      outputHeight: video ? String(video.videoHeight) : "",
      cropRectangle: { x: 0, y: 0, w: 0, h: 0, vw: 0, vh: 0 },
    }));
  },

  reset: () =>
    set(() => ({
      multithreading: supportsMultithreading,

      file: undefined!,
      video: undefined!,

      cursorCurrent: 0,
      cursorStart: 0,
      cursorEnd: 0,
      cropRectangle: {
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        vw: 0,
        vh: 0,
      },

      segments: [],
      selectedSegmentId: null,
      nextSegmentId: 0,

      processing: true,

      ...DEFAULT_EXPORT,
    })),
}));
