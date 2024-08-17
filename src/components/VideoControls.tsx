import { useAppStore } from "@/store.tsx";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

type VideoControlsProps = {
  playing: boolean;
};

const VideoControls = ({ playing }: VideoControlsProps) => {
  const { video, cursorStart, cursorEnd, setCursorCurrent } = useAppStore();

  return (
    <div className={cn("justify-self-center px-2 gap-3 py-1 rounded")}>
      <Button
        variant="link"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          setCursorCurrent(cursorStart);
        }}
      >
        <SkipBack className="h-6 w-6" />
      </Button>

      <Button
        variant="link"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          if (playing) {
            video.pause();
          } else {
            video.play();
          }
        }}
      >
        {playing && <Pause className="h-6 w-6" />}
        {!playing && <Play className="h-6 w-6" />}
      </Button>

      <Button
        variant="link"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          setCursorCurrent(cursorEnd);
        }}
      >
        <SkipForward className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default VideoControls;
