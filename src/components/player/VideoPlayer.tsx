import { useAppStore } from "@/store.tsx";
import { useEffect, useRef, useState } from "react";
import VideoControls from "@/components/player/VideoControls.tsx";
import { cn } from "@/lib/utils.ts";
import { LoaderCircle } from "lucide-react";
import VideoCanvas from "./VideoCanvas";

const VideoPlayer = () => {
  const {
    file,
    cursorEnd,
    cursorCurrent,
    processing,
    setVideo,
    setCursorCurrent,
  } = useAppStore();

  const [playing, setPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  const videoMetadataHandler = () => {
    setVideo(videoRef.current!);
  };

  const videoTimeUpdateHandler = () => {
    if (!videoRef?.current || processing) {
      return;
    }

    setCursorCurrent(videoRef.current.currentTime || 0);

    if (videoRef.current.currentTime > cursorEnd) {
      videoRef.current.pause();
      videoRef.current.currentTime = cursorEnd;
    }
  };

  useEffect(() => {
    if (!videoRef?.current || processing) {
      return;
    }

    if (Math.abs(videoRef.current.currentTime - cursorCurrent) >= 0.01) {
      videoRef.current.currentTime = cursorCurrent;
    }
  }, [cursorCurrent, processing]);

  return (
    <div className="grid mx-auto">
      <div className="flex flex-col gap-4 relative w-max">
        <video
          ref={videoRef}
          className={cn(
            "w-full h-full max-h-[35vh] sm:max-h-[50vh] shadow",
            processing && "invisible",
          )}
          onLoadedMetadata={videoMetadataHandler}
          onTimeUpdate={videoTimeUpdateHandler}
          onPlaying={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          playsInline={true}
          autoPlay={true}
          muted={processing}
        >
          <source src={URL.createObjectURL(file!)} />
        </video>

        <VideoCanvas videoRef={videoRef} />

        {processing && (
          <div className="absolute top-[50%] left-[50%] transform -translate-x-[50%] -translate-y-[50%]">
            <LoaderCircle className={"animate-spin"} />
          </div>
        )}

        <div className="mx-auto bg-secondary rounded">
          <VideoControls playing={playing} />
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
