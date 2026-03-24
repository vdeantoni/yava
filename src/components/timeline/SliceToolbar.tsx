import { useMemo } from "react";
import { useAppStore } from "@/store.tsx";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button.tsx";
import { Scissors, Trash2 } from "lucide-react";
import { MIN_SLICE_DISTANCE } from "@/lib/utils.ts";

const SliceToolbar = () => {
  const {
    segments,
    selectedSegmentId,
    cursorCurrent,
    sliceAtCursor,
    deleteSegment,
    selectSegment,
  } = useAppStore(
    useShallow((s) => ({
      segments: s.segments,
      selectedSegmentId: s.selectedSegmentId,
      cursorCurrent: s.cursorCurrent,
      sliceAtCursor: s.sliceAtCursor,
      deleteSegment: s.deleteSegment,
      selectSegment: s.selectSegment,
    })),
  );

  const canSlice = useMemo(
    () =>
      segments.some(
        (s) =>
          cursorCurrent > s.sourceStart + MIN_SLICE_DISTANCE &&
          cursorCurrent < s.sourceEnd - MIN_SLICE_DISTANCE,
      ),
    [segments, cursorCurrent],
  );

  const canDelete = selectedSegmentId !== null && segments.length > 1;

  return (
    <div className="flex items-center justify-center gap-2 border-t border-border bg-card px-4 py-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1"
        disabled={!canSlice}
        onClick={sliceAtCursor}
      >
        <Scissors className="h-3.5 w-3.5" />
        Slice
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
        disabled={!canDelete}
        onClick={() => {
          if (selectedSegmentId) deleteSegment(selectedSegmentId);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </Button>

      {segments.length > 1 && (
        <span className="text-xs text-muted-foreground ml-2">
          {segments.length} segments
        </span>
      )}

      {selectedSegmentId && (
        <Button
          variant="link"
          className="text-xs h-min p-0 text-primary ml-1"
          onClick={() => selectSegment(null)}
        >
          Clear selection
        </Button>
      )}
    </div>
  );
};

export default SliceToolbar;
