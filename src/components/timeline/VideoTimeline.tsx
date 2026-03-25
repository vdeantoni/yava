import { useAppStore } from "@/store.tsx";
import {
  Fragment,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import VideoThumbnails from "@/components/timeline/VideoThumbnails.tsx";
import { useDebounceCallback, useResizeObserver } from "usehooks-ts";
import { useShallow } from "zustand/react/shallow";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { cn } from "@/lib/utils.ts";
import {
  isMobile,
  secondsToDuration,
  findSegmentAt,
  snapToNearestSegmentBoundary,
} from "@/lib/utils.ts";

export const STEP_SIZE = 0.1;

const TICKS = 100;
const TOTAL_MARKS = 10;
const HANDLE_WIDTH = 16;

const MARK_OPTIONS = [
  1, 5, 10, 15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 420, 480, 540, 600,
  660, 720, 780, 840, 900, 960,
];

const TRACK_RESIZE_OBSERVER_DEBOUNCE_TIME = 200;

const useTrackResizeObserver = (ref: RefObject<HTMLDivElement | null>) => {
  const [width, setWidth] = useState(0);

  const onResize = useDebounceCallback(({ width }) => {
    if (!width) {
      return;
    }

    setWidth(width);
  }, TRACK_RESIZE_OBSERVER_DEBOUNCE_TIME);

  useResizeObserver({
    ref: ref as RefObject<HTMLDivElement>,
    onResize,
    box: "border-box",
  });

  return width;
};

const VideoTimeline = () => {
  const {
    video,
    cursorStart,
    cursorEnd,
    cursorCurrent,
    segments,
    selectedSegmentId,
    setCursorStart,
    setCursorEnd,
    setCursorCurrent,
    selectSegment,
    updateSegmentBounds,
    resetCursors,
  } = useAppStore(
    useShallow((s) => ({
      video: s.video,
      cursorStart: s.cursorStart,
      cursorEnd: s.cursorEnd,
      cursorCurrent: s.cursorCurrent,
      segments: s.segments,
      selectedSegmentId: s.selectedSegmentId,
      setCursorStart: s.setCursorStart,
      setCursorEnd: s.setCursorEnd,
      setCursorCurrent: s.setCursorCurrent,
      selectSegment: s.selectSegment,
      updateSegmentBounds: s.updateSegmentBounds,
      resetCursors: s.resetCursors,
    })),
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const handleDrag = useRef(false);
  const trackWidth = useTrackResizeObserver(trackRef);

  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);
  const [pointerTime, setPointerTime] = useState(0);
  const [checkboxPinnedRight, setCheckboxPinnedRight] = useState(true);

  const segDrag = useRef<{
    segId: string;
    type: "resize" | "move";
    edge?: "start" | "end";
    startX: number;
    startTime: number;
    endTime?: number;
  } | null>(null);

  const onHandlePointerDown = () => {
    handleDrag.current = true;
  };
  const onHandleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleDrag.current = false;
  };

  const onSegHandlePointerDown = (
    e: React.PointerEvent,
    segId: string,
    edge: "start" | "end",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const seg = segments.find((s) => s.id === segId);
    if (!seg) return;
    handleDrag.current = true;
    segDrag.current = {
      segId,
      type: "resize",
      edge,
      startX: e.clientX,
      startTime: edge === "start" ? seg.sourceStart : seg.sourceEnd,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  useEffect(() => {
    resetCursors(video.duration);
  }, [video, resetCursors]);

  const marks = useMemo(() => {
    const markLength =
      MARK_OPTIONS.find(
        (opt) => Math.ceil(video.duration / TOTAL_MARKS) <= opt,
      ) ?? MARK_OPTIONS[0];

    const result: Record<number, number> = {};
    for (let i = 0; i < video.duration / markLength; i++) {
      result[Math.floor((i * markLength * TICKS) / video.duration)] =
        markLength * i;
    }

    return result;
  }, [video.duration]);

  const tickMarks = useMemo(
    () =>
      Array.from({ length: TICKS }, (_, i) => (
        <Fragment key={i}>
          <span className="relative">
            <span className="absolute top-0 left-0 transform -translate-x-[50%]">
              {i && marks[i]
                ? secondsToDuration(marks[i], { trimLeft: isMobile })
                : ""}
            </span>
          </span>
          <span className="mt-2">{"."}</span>
        </Fragment>
      )),
    [marks],
  );

  const hasMultipleSegments = segments.length > 1;

  const getTimeFromEvent = (
    e: React.MouseEvent<HTMLDivElement>,
  ): number => {
    const { width, left } = e.currentTarget.getBoundingClientRect();
    return ((e.clientX - left) / width) * video.duration;
  };

  return (
    <div className="border-t border-border bg-card px-4 lg:px-8 py-1">
      <div
        className="flex flex-col gap-1 cursor-default"
        onClick={(e) => {
          if (handleDrag.current) {
            handleDrag.current = false;
            return;
          }
          video.pause();
          const time = getTimeFromEvent(e);

          const seg = findSegmentAt(segments, time);
          if (seg) {
            setCursorCurrent(
              Math.max(seg.sourceStart, Math.min(seg.sourceEnd, time)),
            );
          } else if (hasMultipleSegments) {
            setCursorCurrent(
              snapToNearestSegmentBoundary(segments, time, cursorStart),
            );
          } else {
            setCursorCurrent(
              Math.max(cursorStart, Math.min(cursorEnd, time)),
            );
          }
        }}
        onMouseMove={(e) => {
          if (!hasMultipleSegments) return;
          const time = getTimeFromEvent(e);
          const seg = findSegmentAt(segments, time);
          setHoveredSegmentId(seg?.id ?? null);
          setPointerTime(time);
        }}
        onMouseLeave={() => {
          setHoveredSegmentId(null);
        }}
        onPointerMove={(e) => {
          if (!segDrag.current) return;
          const { startX, startTime, segId, type, edge, endTime } =
            segDrag.current;
          const dx = e.clientX - startX;
          const timeDelta = dx / (trackWidth / video.duration);

          if (type === "move") {
            let newStart = startTime + timeDelta;
            let newEnd = endTime! + timeDelta;
            const duration = endTime! - startTime;

            // Clamp to video bounds as a unit
            if (newStart < 0) {
              newStart = 0;
              newEnd = duration;
            }
            if (newEnd > video.duration) {
              newEnd = video.duration;
              newStart = video.duration - duration;
            }

            // Clamp to adjacent segments as a unit
            const idx = segments.findIndex((s) => s.id === segId);
            if (idx === -1) return;
            const prev = segments[idx - 1];
            const next = segments[idx + 1];
            if (prev && newStart < prev.sourceEnd) {
              newStart = prev.sourceEnd;
              newEnd = prev.sourceEnd + duration;
            }
            if (next && newEnd > next.sourceStart) {
              newEnd = next.sourceStart;
              newStart = next.sourceStart - duration;
            }

            updateSegmentBounds(segId, newStart, newEnd);
          } else {
            const seg = segments.find((s) => s.id === segId);
            if (!seg) return;
            const newTime = startTime + timeDelta;
            if (edge === "start") {
              updateSegmentBounds(segId, newTime, seg.sourceEnd);
            } else {
              updateSegmentBounds(segId, seg.sourceStart, newTime);
            }
          }
        }}
        onPointerUp={() => {
          segDrag.current = null;
        }}
      >
        <div className="grid grid-flow-col timeline-marks w-full overflow-hidden">
          {tickMarks}
        </div>

        <div ref={trackRef} className="relative h-16">
          {/* Segment highlights */}
          {segments.map((seg, i) => {
            const segStartPct = seg.sourceStart / video.duration;
            const segEndPct = seg.sourceEnd / video.duration;
            const isSelected = seg.id === selectedSegmentId;
            const isHovered = seg.id === hoveredSegmentId;
            const segWidthPx = (segEndPct - segStartPct) * trackWidth;
            const segMidTime = (seg.sourceStart + seg.sourceEnd) / 2;
            const isDragging = segDrag.current !== null;

            return (
              <Fragment key={seg.id}>
                <div
                  className={cn(
                    "absolute h-16 -top-1 z-10",
                    !isDragging && "transition-colors duration-150",
                    isSelected
                      ? "bg-primary/30 ring-1 ring-inset ring-primary pointer-events-auto cursor-grab"
                      : isHovered
                        ? "bg-primary/25 pointer-events-none"
                        : "bg-primary/20 pointer-events-none",
                  )}
                  style={{
                    left: segStartPct * trackWidth,
                    width: segWidthPx,
                  }}
                  onPointerDown={
                    isSelected
                      ? (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDrag.current = true;
                          segDrag.current = {
                            segId: seg.id,
                            type: "move",
                            startX: e.clientX,
                            startTime: seg.sourceStart,
                            endTime: seg.sourceEnd,
                          };
                          (e.target as HTMLElement).setPointerCapture(
                            e.pointerId,
                          );
                        }
                      : undefined
                  }
                >
                  {/* Checkbox for segment selection (hover or selected) */}
                  {hasMultipleSegments &&
                    (isMobile || isHovered || isSelected) && (
                      <div
                        className={cn(
                          "absolute top-0.5 pointer-events-auto z-20",
                          !isDragging &&
                            "transition-[left] duration-150 ease-in-out",
                        )}
                        style={{
                          left:
                            (isSelected
                              ? checkboxPinnedRight
                              : pointerTime > segMidTime)
                              ? segWidthPx - 16
                              : 2,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isSelected) {
                            setCheckboxPinnedRight(
                              pointerTime > segMidTime,
                            );
                          }
                          selectSegment(isSelected ? null : seg.id);
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          className="h-3.5 w-3.5"
                        />
                      </div>
                    )}
                  {/* Resize handles for selected segment */}
                  {isSelected && hasMultipleSegments && (
                    <>
                      <div
                        className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-primary rounded-sm pointer-events-auto cursor-col-resize z-20 shadow"
                        onPointerDown={(e) =>
                          onSegHandlePointerDown(e, seg.id, "start")
                        }
                      />
                      <div
                        className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-primary rounded-sm pointer-events-auto cursor-col-resize z-20 shadow"
                        onPointerDown={(e) =>
                          onSegHandlePointerDown(e, seg.id, "end")
                        }
                      />
                    </>
                  )}
                </div>
                {/* Split line between adjacent segments */}
                {i < segments.length - 1 && (
                  <div
                    className="absolute w-0.5 h-16 -top-1 z-20 bg-primary/60 pointer-events-none"
                    style={{
                      left: segEndPct * trackWidth,
                    }}
                  />
                )}
              </Fragment>
            );
          })}

          <VideoThumbnails trackWidth={trackWidth} />

          {/* Gap overlays for deleted segments */}
          {hasMultipleSegments &&
            segments.map((seg, i) => {
              if (i >= segments.length - 1) return null;
              const nextSeg = segments[i + 1];
              if (nextSeg.sourceStart <= seg.sourceEnd) return null;

              const gapStartPct = seg.sourceEnd / video.duration;
              const gapEndPct = nextSeg.sourceStart / video.duration;

              return (
                <div
                  key={`gap-${seg.id}`}
                  className="absolute h-16 -top-1 z-[5] bg-background/60 pointer-events-none"
                  style={{
                    left: gapStartPct * trackWidth,
                    width: (gapEndPct - gapStartPct) * trackWidth,
                  }}
                />
              );
            })}

          {/* Trim handles — only shown for single segment */}
          {!hasMultipleSegments && (
            <>
              <input
                className="slider-thumb-left"
                type="range"
                min="0"
                max={video.duration}
                step="any"
                value={cursorStart}
                onPointerDown={onHandlePointerDown}
                onClick={onHandleClick}
                onInput={(e) => {
                  const value = +e.currentTarget.value;
                  const firstSegEnd = segments[0]?.sourceEnd ?? cursorEnd;
                  if (value < firstSegEnd - 1) {
                    setCursorStart(value);
                  }
                }}
              />
              <input
                className="slider-thumb-right"
                type="range"
                min="0"
                max={video.duration}
                step="any"
                value={cursorEnd}
                onPointerDown={onHandlePointerDown}
                onClick={onHandleClick}
                onInput={(e) => {
                  const value = +e.currentTarget.value;
                  const lastSegStart =
                    segments[segments.length - 1]?.sourceStart ?? cursorStart;
                  if (value > lastSegStart + 1) {
                    setCursorEnd(value);
                  }
                }}
              />
            </>
          )}

          <input
            className="slider-thumb-current"
            type="range"
            min="0"
            max={video.duration}
            step={STEP_SIZE}
            value={cursorCurrent}
            onPointerDown={onHandlePointerDown}
            onClick={onHandleClick}
            onInput={(e) => {
              video.pause();
              const value = +e.currentTarget.value;
              if (value >= cursorStart && value <= cursorEnd) {
                if (hasMultipleSegments) {
                  const seg = findSegmentAt(segments, value);
                  if (seg) {
                    setCursorCurrent(value);
                  } else {
                    setCursorCurrent(
                      snapToNearestSegmentBoundary(
                        segments,
                        value,
                        cursorStart,
                      ),
                    );
                  }
                } else {
                  setCursorCurrent(value);
                }
              }
            }}
          />
          <div
            className="absolute pointer-events-none z-30"
            style={{
              left:
                (cursorCurrent / video.duration) * (trackWidth - HANDLE_WIDTH) +
                HANDLE_WIDTH / 2,
              top: 0,
            }}
          >
            <div className="w-1 h-14 bg-foreground/80 rounded-full -translate-x-1/2" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoTimeline;
