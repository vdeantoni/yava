import TrimPanel from "@/components/panels/TrimPanel.tsx";
import { useEditor } from "@/stories/editor.ts";

/** One segment from `trim[0]` to `trim[1]` of the 60-second video. */
export const Default = ({ trim = [0, 60] }: { trim?: [number, number] }) => {
  useEditor({
    segments: [{ id: "s0", sourceStart: trim[0], sourceEnd: trim[1] }],
  });
  return <TrimPanel />;
};
