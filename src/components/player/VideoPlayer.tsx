import { useAppStore } from "@/store.tsx";
import { useEffect, useMemo, useRef, useState } from "react";
import VideoControls from "@/components/player/VideoControls.tsx";
import { cn } from "@/lib/utils.ts";
import { LoaderCircle } from "lucide-react";
import VideoCanvas from "./VideoCanvas";

const VideoPlayer = () => {
  const {
    file,
    cursorStart,
    cursorEnd,
    cursorCurrent,
    processing,
    setVideo,
    setCursorCurrent,
  } = useAppStore();

  const [playing, setPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoSrc = useMemo(() => URL.createObjectURL(file!), [file]);

  const videoLoadedDataHandler = () => {
    setVideo(videoRef.current!);
  };

  const videoTimeUpdateHandler = () => {
    if (!videoRef?.current || processing) return;

    if (videoRef.current.currentTime > cursorEnd) {
      videoRef.current.pause();
      videoRef.current.currentTime = cursorEnd;
      setCursorCurrent(cursorEnd);
      return;
    }

    if (videoRef.current.currentTime < cursorStart) {
      videoRef.current.currentTime = cursorStart;
      setCursorCurrent(cursorStart);
      return;
    }

    if (videoRef.current.paused) return;

    setCursorCurrent(videoRef.current.currentTime || 0);
  };

  useEffect(() => {
    const el = videoRef.current;
    if (!el || processing || !el.paused) return;

    if (Math.abs(el.currentTime - cursorCurrent) >= 0.01) {
      el.currentTime = cursorCurrent;
    }
  }, [cursorCurrent, processing]);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="relative flex flex-1 justify-center min-h-0 bg-background">
        <div className="relative max-w-full max-h-full">
          <video
            ref={videoRef}
            className={cn(
              "max-w-full max-h-full object-contain block",
              processing && "invisible",
            )}
            onLoadedData={videoLoadedDataHandler}
            onTimeUpdate={videoTimeUpdateHandler}
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            playsInline={true}
            muted={processing}
          >
            <source src={videoSrc} />
          </video>

          <VideoCanvas videoRef={videoRef} />
        </div>

        {processing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoaderCircle className="animate-spin text-primary h-8 w-8" />
          </div>
        )}
      </div>

      <div className="border-t border-border bg-card">
        <VideoControls playing={playing} />
      </div>
    </div>
  );
};

export default VideoPlayer;
