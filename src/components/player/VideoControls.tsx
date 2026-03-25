import { useAppStore } from "@/store.tsx";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { secondsToDuration, RESTART_TOLERANCE } from "@/lib/utils.ts";

type VideoControlsProps = {
  playing: boolean;
};

const COMPACT_THRESHOLD = 45 * 60;

const VideoControls = ({ playing }: VideoControlsProps) => {
  const {
    video,
    cursorStart,
    cursorEnd,
    cursorCurrent,
    segments,
    setCursorCurrent,
  } = useAppStore();

  const compact = video?.duration < COMPACT_THRESHOLD;
  const durationOpts = { ms: true, compact } as const;

  return (
    <div className="flex items-center justify-between w-full px-4 py-1.5">
      <span className="font-mono text-xs text-muted-foreground min-w-[100px]">
        {secondsToDuration(cursorCurrent || 0, durationOpts)}
      </span>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-foreground hover:text-primary"
          onClick={(e) => {
            e.stopPropagation();
            video.pause();
            setCursorCurrent(cursorStart);
          }}
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-foreground hover:text-primary"
          onClick={(e) => {
            e.stopPropagation();
            if (playing) {
              video.pause();
            } else {
              // If at end of last segment, restart from beginning
              const lastSeg = segments[segments.length - 1];
              if (lastSeg && Math.abs(cursorCurrent - lastSeg.sourceEnd) < RESTART_TOLERANCE) {
                setCursorCurrent(segments[0].sourceStart);
              }
              video.play();
            }
          }}
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-foreground hover:text-primary"
          onClick={(e) => {
            e.stopPropagation();
            video.pause();
            setCursorCurrent(cursorEnd);
          }}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      <span className="font-mono text-xs text-muted-foreground min-w-[100px] text-right">
        {secondsToDuration(
          cursorEnd < video?.duration ? cursorEnd : video?.duration || 0,
          durationOpts,
        )}
      </span>
    </div>
  );
};

export default VideoControls;
