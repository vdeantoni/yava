import { useAppStore } from "@/store.tsx";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { secondsToDuration } from "@/lib/utils.ts";

type VideoControlsProps = {
  playing: boolean;
};

const VideoControls = ({ playing }: VideoControlsProps) => {
  const { video, cursorStart, cursorEnd, cursorCurrent, setCursorCurrent } =
    useAppStore();

  return (
    <div className="flex items-center justify-between w-full px-4 py-1.5">
      <span className="font-mono text-xs text-muted-foreground min-w-[100px]">
        {secondsToDuration(cursorCurrent || 0, { ms: true })}
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
          { ms: true },
        )}
      </span>
    </div>
  );
};

export default VideoControls;
