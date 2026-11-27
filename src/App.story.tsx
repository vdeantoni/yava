import App from "@/App.tsx";
import { useEditor, type EditorState } from "@/stories/editor.ts";

export const Empty = () => <App />;

export const Editing = (state: EditorState) => {
  useEditor(state);
  return <App />;
};
