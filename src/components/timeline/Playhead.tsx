import { RefObject, useRef } from "react";
import { useAppStore } from "@/store.tsx";
import { useShallow } from "zustand/react/shallow";
import { clamp } from "@/lib/utils.ts";
import { playheadTimeAt, timeAtX, xAtTime } from "@/lib/timeline.ts";

type PlayheadProps = {
  trackRef: RefObject<HTMLDivElement | null>;
  trackWidth: number;
  duration: number;
};

/**
 * Its own subscriber to `cursorCurrent`, so a scrub repaints this and nothing
 * else. The track around it renders every segment, handle and tick mark, none
 * of which the playhead position changes.
 */
const Playhead = ({ trackRef, trackWidth, duration }: PlayheadProps) => {
  const { cursorCurrent, setCursorCurrent } = useAppStore(
    useShallow((s) => ({
      cursorCurrent: s.cursorCurrent,
      setCursorCurrent: s.setCursorCurrent,
    })),
  );

  /** Non-null only mid-drag, so it doubles as the gate on pointer moves. */
  const dragRect = useRef<DOMRect | null>(null);

  return (
    <div
      className="absolute z-20"
      style={{
        left: xAtTime(cursorCurrent, duration, trackWidth),
        top: 0,
      }}
    >
      {/* Invisible wider hit area for dragging */}
      <div
        className="absolute -translate-x-1/2 w-4 h-14 cursor-grab pointer-events-auto"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          dragRect.current = trackRef.current!.getBoundingClientRect();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragRect.current) return;
          // Only read on a move, so a segment edit does not re-render this.
          const { segments, cursorStart } = useAppStore.getState();
          const time = clamp(
            timeAtX(e.clientX, dragRect.current, duration),
            duration,
          );
          setCursorCurrent(playheadTimeAt(segments, time, cursorStart));
        }}
        onPointerUp={() => {
          dragRect.current = null;
        }}
        onClick={(e) => {
          // The track would otherwise take the click that ends a drag and move
          // the playhead a second time.
          e.stopPropagation();
        }}
      />
      {/* Visual cursor line */}
      <div className="w-0.5 h-14 bg-primary rounded-full -translate-x-1/2 pointer-events-none shadow-[0_0_6px_hsl(var(--primary)/0.4)]" />
    </div>
  );
};

export default Playhead;
