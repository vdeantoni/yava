import { useAppStore } from "@/store.tsx";
import { useEffect, useMemo, useRef, useState } from "react";
import VideoControls from "@/components/player/VideoControls.tsx";
import { cn, SEEK_TOLERANCE } from "@/lib/utils.ts";
import { nextPlaybackAction } from "@/lib/playback.ts";
import { LoaderCircle } from "lucide-react";
import VideoCanvas from "./VideoCanvas";

const VideoPlayer = () => {
  const {
    file,
    cursorCurrent,
    segments,
    processing,
    setVideo,
    setCursorCurrent,
  } = useAppStore();

  const [playing, setPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoSrc = useMemo(() => URL.createObjectURL(file!), [file]);

  /** Assigning the position the playhead already holds fires another timeupdate. */
  const seekTo = (el: HTMLVideoElement, time: number) => {
    if (Math.abs(el.currentTime - time) > SEEK_TOLERANCE) el.currentTime = time;
  };

  const videoLoadedDataHandler = () => {
    setVideo(videoRef.current!);
  };

  const videoTimeUpdateHandler = () => {
    const el = videoRef.current;
    if (!el || processing) return;

    const action = nextPlaybackAction(segments, el.currentTime);

    if (action.type === "continue") {
      if (!el.paused) setCursorCurrent(el.currentTime);
      return;
    }

    if (action.type === "stop") el.pause();
    seekTo(el, action.time);
    setCursorCurrent(action.time);
  };

  useEffect(() => {
    const el = videoRef.current;
    if (!el || processing || !el.paused) return;

    seekTo(el, cursorCurrent);
  }, [cursorCurrent, processing]);

  return (
    <div className="flex flex-col bg-background">
      <div className="relative overflow-hidden">
        <div className="relative max-w-full mx-auto w-fit">
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

      <div className="shrink-0 border-t border-border bg-card">
        <VideoControls playing={playing} />
      </div>
    </div>
  );
};

export default VideoPlayer;
