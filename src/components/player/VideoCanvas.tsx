import { clamp, cn } from "@/lib/utils.ts";
import { RefObject, useEffect, useRef, useState } from "react";
import { useAppStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { useDebounceCallback, useResizeObserver } from "usehooks-ts";
import {
  anchorForCorner,
  cornerAt,
  drawnRect,
  EMPTY_CROP,
  hasArea,
  isInsideRect,
  movedRect,
  rescaledRect,
  type Corner,
} from "@/lib/crop.ts";

const VIDEO_RESIZE_OBSERVER_DEBOUNCE_TIME = 200;
const HANDLE_SIZE = 10;

/** Drawing and resizing are the same drag: anchor held, pointer free. */
type DragMode = "moving" | "anchored" | null;

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

const VideoCanvas = ({ videoRef }: VideoCanvasProps) => {
  const { processing, cropRectangle, setCropRectangle } = useAppStore(
    useShallow((s) => ({
      processing: s.processing,
      cropRectangle: s.cropRectangle,
      setCropRectangle: s.setCropRectangle,
    })),
  );

  const [videoWidth, videoHeight] = useVideoResizeObserver(videoRef);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const dragMode = useRef<DragMode>(null);
  const moveOffset = useRef({ x: 0, y: 0 });
  const dragAnchor = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!hasArea(cropRectangle)) {
      return;
    }

    // Dark overlay outside crop area
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const { x, y, w, h } = cropRectangle;

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

    const rescaled = rescaledRect(cropRectangle, videoWidth, videoHeight);
    if (rescaled) setCropRectangle(rescaled);
  }, [cropRectangle, videoWidth, videoHeight]);

  const onPointerDown = (px: number, py: number) => {
    // Corners first: they sit on top of the rectangle they belong to.
    const corner = cornerAt(px, py, cropRectangle);
    if (corner) {
      dragMode.current = "anchored";
      dragAnchor.current = anchorForCorner(corner, cropRectangle);
      return;
    }

    if (isInsideRect(px, py, cropRectangle)) {
      dragMode.current = "moving";
      moveOffset.current = {
        x: px - cropRectangle.x,
        y: py - cropRectangle.y,
      };
      return;
    }

    dragMode.current = "anchored";
    const ax = clamp(px, videoWidth);
    const ay = clamp(py, videoHeight);
    dragAnchor.current = { x: ax, y: ay };
    setCropRectangle({
      x: ax,
      y: ay,
      w: 0,
      h: 0,
      vw: videoWidth,
      vh: videoHeight,
    });
  };

  const onPointerMove = (px: number, py: number) => {
    if (!dragMode.current) return;

    px = clamp(px, videoWidth);
    py = clamp(py, videoHeight);

    if (dragMode.current === "moving") {
      setCropRectangle(
        movedRect(cropRectangle, px, py, moveOffset.current, {
          width: videoWidth,
          height: videoHeight,
        }),
      );
      return;
    }

    // Drawing and resizing both run from the anchor to the pointer.
    const drawn = drawnRect(cropRectangle, dragAnchor.current, px, py);
    if (drawn) setCropRectangle(drawn);
  };

  const onPointerUp = () => {
    dragMode.current = null;

    if (!hasArea(cropRectangle)) {
      setCropRectangle(EMPTY_CROP);
    }
  };

  const onHover = (px: number, py: number) => {
    if (!canvasRef.current) return;

    const corner = cornerAt(px, py, cropRectangle);
    if (corner) {
      canvasRef.current.style.cursor = CORNER_CURSORS[corner];
    } else if (isInsideRect(px, py, cropRectangle)) {
      canvasRef.current.style.cursor = "move";
    } else {
      canvasRef.current.style.cursor = "crosshair";
    }
  };

  /**
   * offsetX/offsetY are already relative to the canvas, and reading them costs
   * no layout. Pointer capture keeps them canvas-relative for the whole drag.
   */
  const canvasPos = (e: React.PointerEvent): [number, number] => [
    e.nativeEvent.offsetX,
    e.nativeEvent.offsetY,
  ];

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "absolute top-0 left-0 cursor-crosshair touch-none",
        processing && "invisible",
      )}
      width={videoWidth}
      height={videoHeight}
      title="Draw rectangle to crop, drag to move, corners to resize"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onPointerDown(...canvasPos(e));
      }}
      onPointerMove={(e) => {
        e.preventDefault();
        if (dragMode.current) {
          onPointerMove(...canvasPos(e));
        } else {
          onHover(...canvasPos(e));
        }
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        onPointerUp();
      }}
    />
  );
};

export default VideoCanvas;
