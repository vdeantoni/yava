import { create } from "zustand";
import { FFmpeg } from "@ffmpeg/ffmpeg";

interface AppState {
  ffmpeg: FFmpeg;
  multithreading: boolean;

  file?: File;
  video: HTMLVideoElement;

  cursorCurrent: number;
  cursorStart: number;
  cursorEnd: number;

  processing: boolean;
}

interface AppActions {
  setMultithreading: (multithreading: boolean) => void;

  setVideo: (video: HTMLVideoElement) => void;
  setFile: (file: File) => void;

  setCursorCurrent: (cursorCurrent: number) => void;
  setCursorStart: (cursorStart: number) => void;
  setCursorEnd: (cursorEnd: number) => void;

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

  processing: true,

  setMultithreading: (multithreading: boolean) =>
    set(() => ({ multithreading })),

  setVideo: (video) => set(() => ({ video })),
  setFile: (file) => set(() => ({ file })),

  setCursorCurrent: (cursorCurrent) => set(() => ({ cursorCurrent })),
  setCursorStart: (cursorStart) => set(() => ({ cursorStart })),
  setCursorEnd: (cursorEnd) => set(() => ({ cursorEnd })),

  setProcessing: (processing) => set(() => ({ processing })),

  reset: () =>
    set(() => ({
      // ffmpeg: new FFmpeg(),
      // multithreading: false,

      file: undefined!,
      video: undefined!,

      cursorCurrent: 0,
      cursorStart: 0,
      cursorEnd: 0,

      processing: true,
    })),
}));
