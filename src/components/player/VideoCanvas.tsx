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
const HANDLE_SIZE = 10;
const HANDLE_HIT_SIZE = 14;

type Corner = "tl" | "tr" | "bl" | "br";
type DragMode = "drawing" | "moving" | "resizing" | null;

const CORNER_CURSORS: Record<Corner, string> = {
  tl: "nwse-resize",
  br: "nwse-resize",
  tr: "nesw-resize",
  bl: "nesw-resize",
};

const useVideoResizeObserver = (ref: RefObject<HTMLVideoElement | null>) => {
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
    ref: ref as RefObject<HTMLVideoElement>,
    onResize,
    box: "border-box",
  });

  return [width, height];
};

interface VideoCanvasProps {
  videoRef: RefObject<HTMLVideoElement | null>;
}

const isInsideRect = (
  px: number,
  py: number,
  rect: CropRectangle,
): boolean => {
  return (
    rect.w > 0 &&
    rect.h > 0 &&
    px >= rect.x &&
    px <= rect.x + rect.w &&
    py >= rect.y &&
    py <= rect.y + rect.h
  );
};

const getCornerAt = (
  px: number,
  py: number,
  rect: CropRectangle,
): Corner | null => {
  if (rect.w <= 0 || rect.h <= 0) return null;

  const { x, y, w, h } = rect;
  if (Math.abs(px - x) <= HANDLE_HIT_SIZE && Math.abs(py - y) <= HANDLE_HIT_SIZE) return "tl";
  if (Math.abs(px - (x + w)) <= HANDLE_HIT_SIZE && Math.abs(py - y) <= HANDLE_HIT_SIZE) return "tr";
  if (Math.abs(px - x) <= HANDLE_HIT_SIZE && Math.abs(py - (y + h)) <= HANDLE_HIT_SIZE) return "bl";
  if (Math.abs(px - (x + w)) <= HANDLE_HIT_SIZE && Math.abs(py - (y + h)) <= HANDLE_HIT_SIZE) return "br";

  return null;
};

const VideoCanvas = ({ videoRef }: VideoCanvasProps) => {
  const { processing, cropRectangle, setCropRectangle } = useAppStore();

  const [videoWidth, videoHeight] = useVideoResizeObserver(videoRef);

  const [mouse, canvasRef] = useMouse<HTMLCanvasElement>();

  const dragMode = useRef<DragMode>(null);
  const moveOffset = useRef({ x: 0, y: 0 });
  const resizeCorner = useRef<Corner | null>(null);
  // Anchor is the opposite corner that stays fixed during resize
  const resizeAnchor = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!cropRectangle.w || !cropRectangle.h) {
      return;
    }

    // Dark overlay outside crop area
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const { x, y, w, h, vw, vh } = cropRectangle;

    // Clear the crop area to reveal video
    ctx.clearRect(x, y, w, h);

    // Bright border around crop rectangle
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Corner handles
    ctx.fillStyle = "#0ea5e9";
    const corners = [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x + w, y + h],
    ];
    for (const [cx, cy] of corners) {
      ctx.fillRect(
        cx - HANDLE_SIZE / 2,
        cy - HANDLE_SIZE / 2,
        HANDLE_SIZE,
        HANDLE_SIZE,
      );
    }

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

  const onPointerDown = (px: number, py: number) => {
    // Check corners first (highest priority)
    const corner = getCornerAt(px, py, cropRectangle);
    if (corner) {
      dragMode.current = "resizing";
      resizeCorner.current = corner;
      // The anchor is the opposite corner
      const { x, y, w, h } = cropRectangle;
      const anchors: Record<Corner, { x: number; y: number }> = {
        tl: { x: x + w, y: y + h },
        tr: { x: x, y: y + h },
        bl: { x: x + w, y: y },
        br: { x: x, y: y },
      };
      resizeAnchor.current = anchors[corner];
      return;
    }

    // Then check inside rect (move)
    if (isInsideRect(px, py, cropRectangle)) {
      dragMode.current = "moving";
      moveOffset.current = {
        x: px - cropRectangle.x,
        y: py - cropRectangle.y,
      };
      return;
    }

    // Otherwise draw new
    dragMode.current = "drawing";
    setCropRectangle({
      x: Math.max(0, Math.min(px, videoWidth)),
      y: Math.max(0, Math.min(py, videoHeight)),
      w: 0,
      h: 0,
      vw: videoWidth,
      vh: videoHeight,
    });
  };

  const onPointerMove = (px: number, py: number) => {
    if (!dragMode.current) return;

    // Clamp pointer to canvas
    px = Math.max(0, Math.min(px, videoWidth));
    py = Math.max(0, Math.min(py, videoHeight));

    if (dragMode.current === "moving") {
      let newX = px - moveOffset.current.x;
      let newY = py - moveOffset.current.y;

      newX = Math.max(0, Math.min(newX, videoWidth - cropRectangle.w));
      newY = Math.max(0, Math.min(newY, videoHeight - cropRectangle.h));

      setCropRectangle({
        ...cropRectangle,
        x: newX,
        y: newY,
      });
    } else if (dragMode.current === "resizing") {
      const ax = resizeAnchor.current.x;
      const ay = resizeAnchor.current.y;

      const newX = Math.min(px, ax);
      const newY = Math.min(py, ay);
      const newW = Math.abs(px - ax);
      const newH = Math.abs(py - ay);

      if (newW < 2 || newH < 2) return;

      setCropRectangle({
        ...cropRectangle,
        x: newX,
        y: newY,
        w: newW,
        h: newH,
      });
    } else {
      // Drawing
      let newW = px - cropRectangle.x;
      let newH = py - cropRectangle.y;

      if (newW <= 0 || newH <= 0) return;

      newW = Math.min(newW, videoWidth - cropRectangle.x);
      newH = Math.min(newH, videoHeight - cropRectangle.y);

      setCropRectangle({
        ...cropRectangle,
        w: newW,
        h: newH,
      });
    }
  };

  const onPointerUp = () => {
    dragMode.current = null;
    resizeCorner.current = null;

    if (!cropRectangle.w || !cropRectangle.h) {
      setCropRectangle({ x: 0, y: 0, w: 0, h: 0, vw: 0, vh: 0 });
    }
  };

  const onHover = (px: number, py: number) => {
    if (!canvasRef.current) return;

    const corner = getCornerAt(px, py, cropRectangle);
    if (corner) {
      canvasRef.current.style.cursor = CORNER_CURSORS[corner];
    } else if (isInsideRect(px, py, cropRectangle)) {
      canvasRef.current.style.cursor = "move";
    } else {
      canvasRef.current.style.cursor = "crosshair";
    }
  };

  useEventListener(
    "mousedown",
    (e) => {
      e.preventDefault();
      onPointerDown(mouse.elementX, mouse.elementY);
    },
    canvasRef,
  );

  useEventListener(
    "touchstart",
    (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      onPointerDown(
        e.touches[0].clientX - rect.x,
        e.touches[0].clientY - rect.y,
      );
    },
    canvasRef,
  );

  useEventListener(
    "mousemove",
    (e) => {
      e.preventDefault();
      if (dragMode.current) {
        onPointerMove(mouse.elementX, mouse.elementY);
      } else {
        onHover(mouse.elementX, mouse.elementY);
      }
    },
    canvasRef,
  );

  useEventListener(
    "touchmove",
    (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      onPointerMove(
        e.touches[0].clientX - rect.x,
        e.touches[0].clientY - rect.y,
      );
    },
    canvasRef,
  );

  useEventListener("mouseup", () => onPointerUp(), canvasRef);
  useEventListener("touchend", () => onPointerUp(), canvasRef);
  useEventListener("mouseenter", () => onPointerUp(), canvasRef);
  useEventListener("mouseleave", () => onPointerUp(), canvasRef);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "absolute top-0 left-0 cursor-crosshair",
        processing && "invisible",
      )}
      width={videoWidth}
      height={videoHeight}
      title="Draw rectangle to crop, drag to move, corners to resize"
    />
  );
};

export default VideoCanvas;
