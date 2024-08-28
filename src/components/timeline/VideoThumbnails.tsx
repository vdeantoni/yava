import { useEffect, useRef } from "react";
import { useAppStore } from "@/store.tsx";

const THUMBNAIL_HEIGHT = 56;

type VideoThumbnailsProps = {
  trackWidth: number;
};

const VideoThumbnails = ({ trackWidth }: VideoThumbnailsProps) => {
  const { video, setProcessing } = useAppStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!video || !canvasRef?.current || !trackWidth) {
      return;
    }

    setProcessing(true);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const portrait = video.videoHeight > video.videoWidth;

    const ratio = portrait
      ? video.videoHeight / video.videoWidth
      : video.videoWidth / video.videoHeight;

    const h = THUMBNAIL_HEIGHT;
    const w = Math.round(h * ratio);
    let [dx, dy, dw, dh] = [0, 0, w, h];

    const step = Math.round(video.duration / (trackWidth / w));

    const takeScreenshot = () => {
      requestAnimationFrame(() => {
        ctx.drawImage(video, dx, dy, dw, dh);
        if (video.currentTime < video.duration) {
          dx += w;
          video.currentTime += step;
        } else {
          video.removeEventListener("seeked", takeScreenshot);
          video.pause();
          video.currentTime = 0;
          setProcessing(false);
        }
      });
    };

    video.addEventListener("seeked", takeScreenshot);

    video.currentTime = 0;

    return () => {
      video.removeEventListener("seeked", takeScreenshot);
    };
  }, [video, trackWidth]);

  return (
    <div className="absolute pointer-events-none w-full overflow-hidden">
      <canvas ref={canvasRef} width={trackWidth} height={THUMBNAIL_HEIGHT} />
    </div>
  );
};

export default VideoThumbnails;
