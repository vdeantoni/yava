import { create } from "zustand";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { CropRectangle } from "./components/player/VideoCanvas";

interface AppState {
  ffmpeg: FFmpeg;
  multithreading: boolean;

  file?: Blob;
  video: HTMLVideoElement;

  cursorCurrent: number;
  cursorStart: number;
  cursorEnd: number;
  cropRectangle: CropRectangle;

  processing: boolean;

  format: string;
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

  setFormat: (format: string) => void;
  setFrameRate: (frameRate: number) => void;
  setSpeed: (speed: number) => void;
  setOutputWidth: (outputWidth: string) => void;
  setOutputHeight: (outputHeight: string) => void;
  setNoAudio: (noAudio: boolean) => void;
  resetExportOptions: () => void;

  reset: () => void;
}

const DEFAULT_EXPORT = {
  format: "mp4",
  frameRate: 30,
  speed: 1,
  outputWidth: "",
  outputHeight: "",
  noAudio: false,
};

export const useAppStore = create<AppState & AppActions>()((set, get) => ({
  ffmpeg: new FFmpeg(),
  multithreading: false,

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

  processing: false,

  ...DEFAULT_EXPORT,

  setMultithreading: (multithreading: boolean) =>
    set(() => ({ multithreading })),

  setVideo: (video) => set(() => ({ video })),
  setFile: (file) => set(() => ({ file })),

  setCursorCurrent: (cursorCurrent) => set(() => ({ cursorCurrent })),
  setCursorStart: (cursorStart) =>
    set((state) => ({
      cursorStart,
      cursorCurrent: Math.max(state.cursorCurrent, cursorStart),
    })),
  setCursorEnd: (cursorEnd) =>
    set((state) => ({
      cursorEnd,
      cursorCurrent: Math.min(state.cursorCurrent, cursorEnd),
    })),
  setCropRectangle: (cropRectangle) => set(() => ({ cropRectangle })),

  resetCursors: (duration) =>
    set(() => ({ cursorStart: 0, cursorEnd: duration, cursorCurrent: 0 })),

  setProcessing: (processing) => set(() => ({ processing })),

  setFormat: (format) => set(() => ({ format })),
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
      multithreading: false,

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

      processing: true,

      ...DEFAULT_EXPORT,
    })),
}));
