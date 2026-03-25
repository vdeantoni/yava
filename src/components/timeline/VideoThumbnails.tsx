import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store.tsx";
import { useShallow } from "zustand/react/shallow";

const THUMBNAIL_HEIGHT = 56;
const PARALLEL_EXTRACTORS = 4;

type VideoThumbnailsProps = {
  trackWidth: number;
};

function findNearest(
  cache: Map<number, ImageBitmap>,
  target: number,
): ImageBitmap | undefined {
  let best: ImageBitmap | undefined;
  let bestDist = Infinity;
  for (const [ts, bitmap] of cache) {
    const dist = Math.abs(ts - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = bitmap;
    }
  }
  return best;
}

const VideoThumbnails = ({ trackWidth }: VideoThumbnailsProps) => {
  const { file, video } = useAppStore(
    useShallow((s) => ({
      file: s.file,
      video: s.video,
    })),
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef(new Map<number, ImageBitmap>());
  const frameWidthRef = useRef(0);
  const durationRef = useRef(0);

  const drawFrames = useCallback(() => {
    const canvas = canvasRef.current;
    const cache = cacheRef.current;
    const w = frameWidthRef.current;
    const duration = durationRef.current;
    if (!canvas || !w || !cache.size || !duration) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const numVisible = Math.ceil(canvas.width / w);
    const step = duration / numVisible;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < numVisible; i++) {
      const targetTime = i * step;
      const frame = findNearest(cache, targetTime);
      if (frame) {
        ctx.drawImage(frame, i * w, 0, w, THUMBNAIL_HEIGHT);
      }
    }
  }, []);

  // Extract frames once when video/file changes — uses dedicated off-screen
  // video elements in parallel so the main player is never touched.
  useEffect(() => {
    if (!video || !file || !video.videoWidth || !video.videoHeight) return;

    // Clean up old cache
    for (const bitmap of cacheRef.current.values()) bitmap.close();
    cacheRef.current.clear();

    const h = THUMBNAIL_HEIGHT;
    const w = Math.round(h * (video.videoWidth / video.videoHeight));
    if (w <= 0) return;
    frameWidthRef.current = w;
    durationRef.current = video.duration;

    // Generate enough frames to fill the widest likely viewport
    const maxWidth = window.screen.width;
    const numFrames = Math.ceil(maxWidth / w) + 1;
    const step = video.duration / numFrames;

    let completedExtractors = 0;
    let cancelled = false;
    const cleanups: (() => void)[] = [];
    const numExtractors = Math.min(PARALLEL_EXTRACTORS, numFrames);

    for (let ei = 0; ei < numExtractors; ei++) {
      const thumbVideo = document.createElement("video");
      thumbVideo.preload = "auto";
      thumbVideo.muted = true;
      thumbVideo.playsInline = true;
      const blobUrl = URL.createObjectURL(file);
      thumbVideo.src = blobUrl;

      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.width = w;
      tmpCanvas.height = h;
      const tmpCtx = tmpCanvas.getContext("2d")!;

      let slot = ei;

      const captureAndAdvance = async () => {
        if (cancelled) return;

        const timestamp = slot * step;
        tmpCtx.drawImage(thumbVideo, 0, 0, w, h);
        try {
          const bitmap = await createImageBitmap(tmpCanvas);
          if (cancelled) {
            bitmap.close();
            return;
          }
          cacheRef.current.set(timestamp, bitmap);
          drawFrames();
        } catch {
          // ignore extraction errors for individual frames
        }

        slot += numExtractors;
        if (slot < numFrames) {
          thumbVideo.currentTime = slot * step;
        } else {
          completedExtractors++;
        }
      };

      const onSeeked = () => {
        if (!cancelled) captureAndAdvance();
      };
      thumbVideo.addEventListener("seeked", onSeeked);

      thumbVideo.addEventListener(
        "loadeddata",
        () => {
          if (cancelled) return;
          if (slot * step < 0.001) {
            captureAndAdvance();
          } else {
            thumbVideo.currentTime = slot * step;
          }
        },
        { once: true },
      );

      cleanups.push(() => {
        thumbVideo.removeEventListener("seeked", onSeeked);
        URL.revokeObjectURL(blobUrl);
        thumbVideo.src = "";
        thumbVideo.load();
      });
    }

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
      for (const bitmap of cacheRef.current.values()) bitmap.close();
      cacheRef.current.clear();
    };
  }, [video, file, drawFrames]);

  // Redraw cached frames when canvas width changes (cheap — no video seeking)
  useEffect(() => {
    if (trackWidth > 0) {
      drawFrames();
    }
  }, [trackWidth, drawFrames]);

  return (
    <div className="absolute pointer-events-none w-full overflow-hidden">
      <canvas ref={canvasRef} width={trackWidth} height={THUMBNAIL_HEIGHT} />
    </div>
  );
};

export default VideoThumbnails;
