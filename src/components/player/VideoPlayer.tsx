import { useAppStore } from "@/store.tsx";
import { useShallow } from "zustand/react/shallow";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VideoControls from "@/components/player/VideoControls.tsx";
import { cn, describeMediaError, SEEK_TOLERANCE } from "@/lib/utils.ts";
import { nextPlaybackAction } from "@/lib/playback.ts";
import { fadeGainAt } from "@/lib/fade.ts";
import { LoaderCircle } from "lucide-react";
import VideoCanvas from "./VideoCanvas";

/** Ten times the slowest first-frame report measured on a working source. */
const FRAME_CHECK_MS = 2000;

const NO_FRAMES_MESSAGE =
  "This browser decoded no frames from this video, so there is no preview. Exporting still works, because FFmpeg decodes the file itself.";

const VideoPlayer = () => {
  const {
    file,
    video,
    cursorCurrent,
    segments,
    processing,
    setVideo,
    setCursorCurrent,
  } = useAppStore(
    useShallow((s) => ({
      file: s.file,
      video: s.video,
      cursorCurrent: s.cursorCurrent,
      segments: s.segments,
      processing: s.processing,
      setVideo: s.setVideo,
      setCursorCurrent: s.setCursorCurrent,
    })),
  );

  const [playing, setPlaying] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [noFrames, setNoFrames] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  /** Last painted level, so a playhead that moved outside a fade costs nothing. */
  const lastGainRef = useRef(-1);
  const videoSrc = useMemo(() => URL.createObjectURL(file!), [file]);

  /** Assigning the position the playhead already holds fires another timeupdate. */
  const seekTo = (el: HTMLVideoElement, time: number) => {
    if (Math.abs(el.currentTime - time) > SEEK_TOLERANCE) el.currentTime = time;
  };

  const videoLoadedDataHandler = () => {
    setVideo(videoRef.current!);
  };

  /**
   * A codec the browser cannot decode does not always raise an error. It can
   * report metadata and readyState 4, fire loadeddata, and then produce no
   * frames at all, which looks like a black player and an empty timeline.
   * A working source counts its first frame within ~200ms of loadeddata.
   */
  useEffect(() => {
    if (!video?.getVideoPlaybackQuality) return;

    const timer = setTimeout(() => {
      setNoFrames(video.getVideoPlaybackQuality().totalVideoFrames === 0);
    }, FRAME_CHECK_MS);

    return () => clearTimeout(timer);
  }, [video]);

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

  const hasFades = useMemo(
    () => segments.some((s) => s.fadeIn || s.fadeOut),
    [segments],
  );

  /** Darken the picture and duck the volume the way the export will. */
  const paintFade = useCallback(() => {
    const overlay = fadeRef.current;
    const el = videoRef.current;
    if (!overlay || !el) return;

    const gain = fadeGainAt(segments, el.currentTime);
    if (gain === lastGainRef.current) return;
    lastGainRef.current = gain;

    overlay.style.opacity = String(1 - gain);
    el.volume = gain;
  }, [segments]);

  useEffect(paintFade, [paintFade, cursorCurrent]);

  // timeupdate fires a handful of times a second, which is coarse enough that a
  // fade driven off it visibly steps.
  useEffect(() => {
    if (!playing || !hasFades) return;

    let raf = 0;
    const loop = () => {
      paintFade();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(raf);
  }, [playing, hasFades, paintFade]);

  const warning = mediaError || (noFrames ? NO_FRAMES_MESSAGE : "");

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
            onError={(e) =>
              setMediaError(describeMediaError(e.currentTarget.error?.code))
            }
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            playsInline={true}
            muted={processing}
          >
            <source src={videoSrc} />
          </video>

          <div
            ref={fadeRef}
            className={cn(
              "absolute inset-0 bg-black opacity-0 pointer-events-none",
              processing && "invisible",
            )}
          />

          <VideoCanvas videoRef={videoRef} />
        </div>

        {processing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoaderCircle className="animate-spin text-primary h-8 w-8" />
          </div>
        )}

        {warning && !processing && (
          <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
            <p className="max-w-sm text-center text-sm text-destructive">
              {warning}
            </p>
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
