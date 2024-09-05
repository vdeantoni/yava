import { cn } from "@/lib/utils.ts";
import { RefObject, useEffect, useRef, useState } from "react";
import { useAppStore } from "../../store";
import {
  useDebounceCallback,
  useEventListener,
  useResizeObserver,
} from "usehooks-ts";
import { useMouse } from "@uidotdev/usehooks";

export type CropRectangle = {
  x: number;
  y: number;
  w: number;
  h: number;
  vw: number;
  vh: number;
};

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

    setSize({ width: Math.ceil(width), height: Math.ceil(height) });
  }, VIDEO_RESIZE_OBSERVER_DEBOUNCE_TIME);

  useResizeObserver({
    ref,
    onResize,
    box: "border-box",
  });

  return [width, height];
};

interface VideoCanvasProps {
  videoRef: RefObject<HTMLVideoElement>;
}

const VideoCanvas = ({ videoRef }: VideoCanvasProps) => {
  const { processing, cropRectangle, setCropRectangle } = useAppStore();

  const [videoWidth, videoHeight] = useVideoResizeObserver(videoRef);

  const [mouse, canvasRef] = useMouse<HTMLCanvasElement>();

  const isDragging = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!cropRectangle.w || !cropRectangle.y) {
      return;
    }

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const { x, y, w, h, vw, vh } = cropRectangle;

    ctx.clearRect(x, y, w, h);

    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(x, y, w, h);

    if (vw !== videoWidth || vh !== videoHeight) {
      const px = videoWidth / vw;
      const py = videoHeight / vh;
      setCropRectangle({
        ...cropRectangle,
        x: cropRectangle.x * px,
        y: cropRectangle.y * py,
        w: cropRectangle.w * px,
        h: cropRectangle.h * py,
        vw: videoWidth,
        vh: videoHeight,
      });
    }
  }, [cropRectangle, videoWidth, videoHeight]);

  const onDragStart = (x: number, y: number) => {
    isDragging.current = true;

    setCropRectangle({
      x,
      y,
      w: 0,
      h: 0,
      vw: videoWidth,
      vh: videoHeight,
    });
  };

  const onDrag = (x: number, y: number) => {
    if (isDragging.current) {
      const newX = x - cropRectangle.x;
      const newY = y - cropRectangle.y;

      if (newX <= 0 || newY <= 0) {
        return;
      }

      setCropRectangle({
        ...cropRectangle,
        w: x - cropRectangle.x,
        h: y - cropRectangle.y,
      });
    }
  };

  const onDragStop = () => {
    isDragging.current = false;

    if (!cropRectangle.w || !cropRectangle.h) {
      setCropRectangle({ x: 0, y: 0, w: 0, h: 0, vw: 0, vh: 0 });
    }
  };

  useEventListener(
    "mousedown",
    (e) => {
      e.preventDefault();
      onDragStart(mouse.elementX, mouse.elementY);
    },
    canvasRef,
  );

  useEventListener(
    "touchstart",
    (e: TouchEvent) => {
      e.preventDefault();
      onDragStart(
        e.touches[0].clientX - canvasRef.current.getBoundingClientRect().x,
        e.touches[0].clientY - canvasRef.current.getBoundingClientRect().y,
      );
    },
    canvasRef,
  );

  useEventListener(
    "mousemove",
    (e) => {
      e.preventDefault();
      onDrag(mouse.elementX, mouse.elementY);
    },
    canvasRef,
  );

  useEventListener(
    "touchmove",
    (e: TouchEvent) => {
      e.preventDefault();
      onDrag(
        e.touches[0].clientX - canvasRef.current.getBoundingClientRect().x,
        e.touches[0].clientY - canvasRef.current.getBoundingClientRect().y,
      );
    },
    canvasRef,
  );

  useEventListener(
    "mouseup",
    () => {
      onDragStop();
    },
    canvasRef,
  );

  useEventListener(
    "touchend",
    () => {
      onDragStop();
    },
    canvasRef,
  );

  useEventListener(
    "mouseenter",
    () => {
      onDragStop();
    },
    canvasRef,
  );

  useEventListener(
    "mouseleave",
    () => {
      onDragStop();
    },
    canvasRef,
  );

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        `absolute top-0 left-0 cursor-crosshair`,
        processing && "invisible",
      )}
      width={videoWidth}
      height={videoHeight}
      title="Draw rectangle to crop video"
    />
  );
};

export default VideoCanvas;
