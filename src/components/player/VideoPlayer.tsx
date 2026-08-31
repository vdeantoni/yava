import { useAppStore } from "@/store.tsx";
import { useShallow } from "zustand/react/shallow";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VideoControls from "@/components/player/VideoControls.tsx";
import { cn, SEEK_TOLERANCE } from "@/lib/utils.ts";
import {
  describeBlankPicture,
  describeMediaError,
  describeMissingMetadata,
  type MediaNotice,
} from "@/lib/media-notice.ts";
import { formatBytes } from "@/lib/fetch-progress.ts";
import { nextPlaybackAction } from "@/lib/playback.ts";
import { fadeGainAt } from "@/lib/fade.ts";
import { LoaderCircle } from "lucide-react";
import VideoCanvas from "./VideoCanvas";

/** Grace for the first frame once the metadata has landed. */
const FRAME_CHECK_MS = 2000;

/**
 * How long metadata gets to arrive before the player calls the load stuck. The
 * file is already local by this point, so nothing is waiting on the network.
 */
const METADATA_TIMEOUT_MS = 15000;

/**
 * Caps the picture at the room --editor-chrome leaves it. The floor keeps a
 * short window from clamping the height to nothing and blanking the player.
 */
const pictureHeightClass =
  "max-h-[max(120px,calc(100svh-var(--editor-chrome)))]";

const VideoPlayer = () => {
  // Neither the playhead nor the segments are rendered here, so neither is
  // subscribed to: both change at pointer rate and would re-render the player
  // and its canvas for nothing. Handlers read them with getState, and the fade
  // overlay follows them through the subscription below.
  const { file, video, hasFades, processing, setVideo, setCursorCurrent } =
    useAppStore(
      useShallow((s) => ({
        file: s.file,
        video: s.video,
        hasFades: s.segments.some((seg) => seg.fadeIn || seg.fadeOut),
        processing: s.processing,
        setVideo: s.setVideo,
        setCursorCurrent: s.setCursorCurrent,
      })),
    );

  const [playing, setPlaying] = useState(false);
  /**
   * What this source has to say for itself, if anything. An error the element
   * raised overwrites; the timers below only fill an empty slot.
   */
  const [notice, setNotice] = useState<MediaNotice | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  /** Last painted level, so a playhead that moved outside a fade costs nothing. */
  const lastGainRef = useRef(-1);
  /**
   * Carried on the element rather than a `<source>` child: changing a child's
   * src does not restart the load without an imperative `load()` call.
   */
  const videoSrc = useMemo(() => URL.createObjectURL(file!), [file]);

  /** Assigning the position the playhead already holds fires another timeupdate. */
  const seekTo = (el: HTMLVideoElement, time: number) => {
    if (Math.abs(el.currentTime - time) > SEEK_TOLERANCE) el.currentTime = time;
  };

  /**
   * Everything below the player needs the duration and the intrinsic size, and
   * both land with the metadata. Holding out for a decoded frame instead leaves
   * the whole editor unbuilt on a source that reports itself and then stalls.
   */
  const videoLoadedMetadataHandler = () => {
    setVideo(videoRef.current!);
  };

  /**
   * A codec the browser cannot decode does not always raise an error. It can
   * report metadata and readyState 4, fire loadeddata, and then produce no
   * frames at all, which looks like a black player and an empty timeline.
   * A working source counts its first frame within ~200ms of the metadata.
   */
  useEffect(() => {
    if (!video?.getVideoPlaybackQuality) return;

    const timer = setTimeout(() => {
      if (video.getVideoPlaybackQuality().totalVideoFrames > 0) return;

      setNotice(
        (current) =>
          current ?? describeBlankPicture(video.readyState, video.networkState),
      );
    }, FRAME_CHECK_MS);

    return () => clearTimeout(timer);
  }, [video]);

  /**
   * Metadata that never arrives raises nothing either, and the editor is not
   * built without it, so there is nothing on the page left to report the
   * failure. Disarms as soon as the metadata lands.
   */
  useEffect(() => {
    if (video) return;

    const timer = setTimeout(() => {
      const el = videoRef.current;
      if (!el) return;

      setNotice(
        (current) =>
          current ?? describeMissingMetadata(el.readyState, el.networkState),
      );
    }, METADATA_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [video]);

  const videoTimeUpdateHandler = () => {
    const el = videoRef.current;
    if (!el || processing) return;

    const { segments } = useAppStore.getState();
    const action = nextPlaybackAction(segments, el.currentTime);

    if (action.type === "continue") {
      if (!el.paused) setCursorCurrent(el.currentTime);
      return;
    }

    if (action.type === "stop") el.pause();
    seekTo(el, action.time);
    setCursorCurrent(action.time);
  };

  /** Darken the picture and duck the volume the way the export will. */
  const paintFade = useCallback(() => {
    const overlay = fadeRef.current;
    const el = videoRef.current;
    if (!overlay || !el) return;

    const { segments } = useAppStore.getState();
    const gain = fadeGainAt(segments, el.currentTime);
    if (gain === lastGainRef.current) return;
    lastGainRef.current = gain;

    overlay.style.opacity = String(1 - gain);
    el.volume = gain;
  }, []);

  /**
   * Seek and repaint off the store rather than off a render.
   *
   * Segments matter as much as the playhead here: removing a fade the playhead
   * is sitting inside has to brighten the picture without either moving.
   */
  useEffect(() => {
    const follow = () => {
      const el = videoRef.current;
      if (!el) return;

      if (!processing && el.paused) {
        seekTo(el, useAppStore.getState().cursorCurrent);
      }
      paintFade();
    };

    follow();

    return useAppStore.subscribe((s, previous) => {
      if (
        s.cursorCurrent !== previous.cursorCurrent ||
        s.segments !== previous.segments
      ) {
        follow();
      }
    });
  }, [processing, paintFade]);

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

  return (
    <div className="flex flex-col bg-background">
      <div className="relative overflow-hidden">
        <div className="relative max-w-full mx-auto w-fit">
          <video
            ref={videoRef}
            className={cn(
              "max-w-full object-contain block",
              pictureHeightClass,
              processing && "invisible",
            )}
            src={videoSrc}
            onLoadedMetadata={videoLoadedMetadataHandler}
            // A frame has arrived, so whatever the picture was missing it is
            // not missing now. An element that errored never gets here.
            onLoadedData={() => setNotice(null)}
            onTimeUpdate={videoTimeUpdateHandler}
            onError={(e) =>
              setNotice(describeMediaError(e.currentTarget.error?.code))
            }
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            playsInline={true}
            muted={processing}
          />

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

        {notice && !processing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 pointer-events-none">
            <p
              className={cn(
                "max-w-sm text-center text-sm",
                notice.tone === "error" && "text-destructive",
              )}
            >
              {notice.message}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              {notice.detail} · {formatBytes(file!.size)}
            </p>
          </div>
        )}
      </div>

      {video && (
        <div className="shrink-0 border-t border-border bg-card">
          <VideoControls playing={playing} />
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
