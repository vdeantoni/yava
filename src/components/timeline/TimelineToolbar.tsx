import { useAppStore } from "@/store.tsx";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button.tsx";
import { Scissors, Sunrise, Sunset, type LucideIcon } from "lucide-react";
import { cn, sliceIndexAt } from "@/lib/utils.ts";
import { fadeIntent, type FadeKind } from "@/lib/fade.ts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";

/** A toggle keeps one name whatever its state, so the tooltip carries the change. */
const FADE_HINTS: Record<FadeKind, { set: string; clear: string }> = {
  in: {
    set: "Fade up from black, from the start of the segment to the needle",
    clear: "Remove the fade in on this segment",
  },
  out: {
    set: "Fade down to black, from the needle to the end of the segment",
    clear: "Remove the fade out on this segment",
  },
};

type ToolButtonProps = {
  icon: LucideIcon;
  label: string;
  hint: string;
  disabled: boolean;
  /** Omitted on plain actions; set makes the button a toggle. */
  pressed?: boolean;
  onClick: () => void;
};

const ToolButton = ({
  icon: Icon,
  label,
  hint,
  disabled,
  pressed,
  onClick,
}: ToolButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7",
          pressed && "text-primary bg-primary/15 hover:bg-primary/25",
        )}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon className="h-3.5 w-3.5" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p className="text-xs">{hint}</p>
    </TooltipContent>
  </Tooltip>
);

const TimelineToolbar = () => {
  // Every button's state is derived in the selector, so a playhead that moves
  // without flipping one of these does not re-render the toolbar.
  const {
    canSlice,
    fadeInEnabled,
    fadeInActive,
    fadeOutEnabled,
    fadeOutActive,
    sliceAtCursor,
    fadeAtCursor,
  } = useAppStore(
    useShallow((s) => {
      const { segments, cursorCurrent } = s;
      const fadeIn = fadeIntent(segments, cursorCurrent, "in");
      const fadeOut = fadeIntent(segments, cursorCurrent, "out");

      return {
        canSlice: sliceIndexAt(segments, cursorCurrent) !== -1,
        fadeInEnabled: fadeIn !== null,
        fadeInActive: fadeIn?.duration === 0,
        fadeOutEnabled: fadeOut !== null,
        fadeOutActive: fadeOut?.duration === 0,
        sliceAtCursor: s.sliceAtCursor,
        fadeAtCursor: s.fadeAtCursor,
      };
    }),
  );

  return (
    <div className="flex items-center justify-center gap-2 border-t border-border bg-card px-4 py-1">
      <TooltipProvider>
        <ToolButton
          icon={Scissors}
          label="Slice at the playhead"
          hint="Slice video segment into two on the current position of the needle"
          disabled={!canSlice}
          onClick={sliceAtCursor}
        />
        <ToolButton
          icon={Sunrise}
          label="Fade in"
          hint={fadeInActive ? FADE_HINTS.in.clear : FADE_HINTS.in.set}
          disabled={!fadeInEnabled}
          pressed={fadeInActive}
          onClick={() => fadeAtCursor("in")}
        />
        <ToolButton
          icon={Sunset}
          label="Fade out"
          hint={fadeOutActive ? FADE_HINTS.out.clear : FADE_HINTS.out.set}
          disabled={!fadeOutEnabled}
          pressed={fadeOutActive}
          onClick={() => fadeAtCursor("out")}
        />
      </TooltipProvider>
    </div>
  );
};

export default TimelineToolbar;
