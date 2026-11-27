import { useState } from "react";
import { commitSegments } from "@/lib/segments.ts";
import { useAppStore, type Segment, type UrlEditState } from "@/store.tsx";

/** What a story lets a test choose, as plain data `mount` can carry. */
export type EditorState = {
  segments?: Segment[];
  cursorCurrent?: number;
  pendingEditState?: UrlEditState;
};

/**
 * Opens the editor on a 60-second 1920x1080 video. The export panel derives its
 * output size from those dimensions, so a video without them puts NaN there.
 */
export function useEditor({
  segments = [{ id: "s0", sourceStart: 0, sourceEnd: 60 }],
  cursorCurrent = 30,
  pendingEditState,
}: EditorState = {}) {
  // An initializer runs during the first render, before any child reads the store.
  useState(() =>
    useAppStore.setState({
      video: {
        duration: 60,
        videoWidth: 1920,
        videoHeight: 1080,
      } as HTMLVideoElement,
      file: new Blob(["fake"], { type: "video/mp4" }),
      selectedSegmentId: null,
      nextSegmentId: segments.length,
      pendingEditState: pendingEditState ?? null,
      ...commitSegments(segments, cursorCurrent),
    }),
  );
}
