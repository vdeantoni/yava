import { create } from "zustand";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { CropRectangle } from "./components/player/VideoCanvas";

interface AppState {
  ffmpeg: FFmpeg;
  multithreading: boolean;

  file?: File;
  video: HTMLVideoElement;

  cursorCurrent: number;
  cursorStart: number;
  cursorEnd: number;
  cropRectangle: CropRectangle;

  processing: boolean;
}

interface AppActions {
  setMultithreading: (multithreading: boolean) => void;

  setVideo: (video: HTMLVideoElement) => void;
  setFile: (file: File) => void;

  setCursorCurrent: (cursorCurrent: number) => void;
  setCursorStart: (cursorStart: number) => void;
  setCursorEnd: (cursorEnd: number) => void;
  setCropRectangle: (cropRectangle: CropRectangle) => void;

  setProcessing: (processing: boolean) => void;

  reset: () => void;
}

export const useAppStore = create<AppState & AppActions>()((set) => ({
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

  processing: true,

  setMultithreading: (multithreading: boolean) =>
    set(() => ({ multithreading })),

  setVideo: (video) => set(() => ({ video })),
  setFile: (file) => set(() => ({ file })),

  setCursorCurrent: (cursorCurrent) => set(() => ({ cursorCurrent })),
  setCursorStart: (cursorStart) => set(() => ({ cursorStart })),
  setCursorEnd: (cursorEnd) => set(() => ({ cursorEnd })),
  setCropRectangle: (cropRectangle) => set(() => ({ cropRectangle })),

  setProcessing: (processing) => set(() => ({ processing })),

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
    })),
}));
