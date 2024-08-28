import { useAppStore } from "@/store.tsx";
import { RefObject, useEffect, useRef, useState } from "react";
import { STEP_SIZE } from "@/components/timeline/VideoTimeline.tsx";
import VideoControls from "@/components/player/VideoControls.tsx";
import { cn } from "@/lib/utils.ts";
import { LoaderCircle } from "lucide-react";
import { useDebounceCallback, useResizeObserver } from "usehooks-ts";

const VIDEO_RESIZE_OBSERVER_DEBOUNCE_TIME = 200;

const useVideoResizeObserver = (ref: RefObject<HTMLVideoElement>) => {
  const [{ width, height }, setSize] = useState({
    width: 0,
    height: 0,
  });

  const onResize = useDebounceCallback(({ width, height }) => {
    if (!width || !height) {
      return;
    }

    setSize({ width, height });
  }, VIDEO_RESIZE_OBSERVER_DEBOUNCE_TIME);

  useResizeObserver({
    ref,
    onResize,
    box: "border-box",
  });

  return [width, height];
};

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
  const [videoWidth, videoHeight] = useVideoResizeObserver(videoRef);

  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    if (Math.abs(videoRef.current.currentTime - cursorCurrent) > STEP_SIZE) {
      videoRef.current.currentTime = cursorCurrent;
    }
  }, [cursorCurrent, processing]);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex flex-col gap-4 relative">
        <video
          ref={videoRef}
          className={cn(
            "max-h-[35vh] sm:max-h-[50vh] shadow",
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

        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 cursor-crosshair"
          width={videoWidth}
          height={videoHeight}
        />

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
