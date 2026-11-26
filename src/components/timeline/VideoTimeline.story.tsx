import VideoTimeline from "@/components/timeline/VideoTimeline.tsx";
import { useEditor, type EditorState } from "@/stories/editor.ts";

export const Default = (state: EditorState) => {
  useEditor(state);
  return <VideoTimeline />;
};
