import type { HooksConfig } from "../playwright/index";

export const defaultEditorStore = {
  // Dimensions matter: the export panel derives its output size from them, and
  // a video without them puts NaN in those inputs.
  video: {
    duration: 60,
    videoWidth: 1920,
    videoHeight: 1080,
  } as HTMLVideoElement,
  file: true, // Replaced with real Blob in beforeMount hook (can't serialize Blob across Node→browser)
  cursorStart: 0,
  cursorEnd: 60,
  cursorCurrent: 30,
  segments: [{ id: "s0", sourceStart: 0, sourceEnd: 60 }],
  selectedSegmentId: null,
  nextSegmentId: 1,
};

export function withStore(overrides: Record<string, unknown> = {}): {
  hooksConfig: HooksConfig;
} {
  return {
    hooksConfig: {
      storeState: { ...defaultEditorStore, ...overrides },
    },
  };
}
