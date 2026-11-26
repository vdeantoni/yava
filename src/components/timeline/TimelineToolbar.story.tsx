import TimelineToolbar from "@/components/timeline/TimelineToolbar.tsx";
import { useEditor, type EditorState } from "@/stories/editor.ts";

export const Default = (state: EditorState) => {
  useEditor(state);
  return <TimelineToolbar />;
};
