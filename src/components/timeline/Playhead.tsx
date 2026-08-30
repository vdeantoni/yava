import { RefObject, useRef } from "react";
import { useAppStore } from "@/store.tsx";
import { useShallow } from "zustand/react/shallow";
import {
  clamp,
  findSegmentAt,
  snapToNearestSegmentBoundary,
} from "@/lib/utils.ts";
import { timeAtX } from "@/lib/timeline.ts";

type PlayheadProps = {
  trackRef: RefObject<HTMLDivElement | null>;
  trackWidth: number;
  duration: number;
  /** Shared with the track, which swallows the click that ends a drag. */
  dragging: RefObject<boolean>;
};

/**
 * Its own subscriber to `cursorCurrent`, so a scrub repaints this and nothing
 * else. The track around it renders every segment, handle and tick mark, none
 * of which the playhead position changes.
 */
const Playhead = ({
  trackRef,
  trackWidth,
  duration,
  dragging,
}: PlayheadProps) => {
  const { cursorCurrent, cursorStart, cursorEnd, segments, setCursorCurrent } =
    useAppStore(
      useShallow((s) => ({
        cursorCurrent: s.cursorCurrent,
        cursorStart: s.cursorStart,
        cursorEnd: s.cursorEnd,
        segments: s.segments,
        setCursorCurrent: s.setCursorCurrent,
      })),
    );

  const dragRect = useRef<DOMRect | null>(null);

  return (
    <div
      className="absolute z-20"
      style={{
        left: (cursorCurrent / duration) * trackWidth,
        top: 0,
      }}
    >
      {/* Invisible wider hit area for dragging */}
      <div
        className="absolute -translate-x-1/2 w-4 h-14 cursor-grab pointer-events-auto"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          dragging.current = true;
          dragRect.current = trackRef.current!.getBoundingClientRect();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragging.current || !dragRect.current) return;
          const rect = dragRect.current;
          const time = clamp(timeAtX(e.clientX, rect, duration), duration);
          if (time >= cursorStart && time <= cursorEnd) {
            const seg = findSegmentAt(segments, time);
            if (seg) {
              setCursorCurrent(time);
            } else {
              setCursorCurrent(
                snapToNearestSegmentBoundary(segments, time, cursorStart),
              );
            }
          }
        }}
        onPointerUp={() => {
          dragging.current = false;
          dragRect.current = null;
        }}
        onClick={(e) => {
          e.stopPropagation();
          dragging.current = false;
        }}
      />
      {/* Visual cursor line */}
      <div className="w-0.5 h-14 bg-primary rounded-full -translate-x-1/2 pointer-events-none shadow-[0_0_6px_hsl(var(--primary)/0.4)]" />
    </div>
  );
};

export default Playhead;
