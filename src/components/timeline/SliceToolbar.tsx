import { useMemo } from "react";
import { useAppStore } from "@/store.tsx";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button.tsx";
import { Scissors } from "lucide-react";
import { MIN_SLICE_DISTANCE } from "@/lib/utils.ts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";

const SliceToolbar = () => {
  const { segments, cursorCurrent, sliceAtCursor } = useAppStore(
    useShallow((s) => ({
      segments: s.segments,
      cursorCurrent: s.cursorCurrent,
      sliceAtCursor: s.sliceAtCursor,
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

  return (
    <div className="flex items-center justify-center gap-2 border-t border-border bg-card px-4 py-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!canSlice}
              onClick={sliceAtCursor}
            >
              <Scissors className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              Slice video segment into two on the current position of the needle
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default SliceToolbar;
