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
import {
  cn,
  isMobile,
  secondsToDuration,
  findSegmentAt,
  snapToNearestSegmentBoundary,
  FLUSH_TOLERANCE,
} from "@/lib/utils.ts";
import { Merge, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";

export const STEP_SIZE = 0.1;

const MIN_MARK_SPACING_PX = 80;
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
    setCursorCurrent,
    selectSegment,
    deleteSegment,
    joinSegment,
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
      setCursorCurrent: s.setCursorCurrent,
      selectSegment: s.selectSegment,
      deleteSegment: s.deleteSegment,
      joinSegment: s.joinSegment,
      updateSegmentBounds: s.updateSegmentBounds,
      resetCursors: s.resetCursors,
    })),
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const handleDrag = useRef(false);
  const trackWidth = useTrackResizeObserver(trackRef);

  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);

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
    const totalMarks = Math.max(
      2,
      Math.floor((trackWidth || 600) / MIN_MARK_SPACING_PX),
    );
    const markLength =
      MARK_OPTIONS.find(
        (opt) => Math.ceil(video.duration / totalMarks) <= opt,
      ) ?? MARK_OPTIONS[0];

    const major: { time: number; pct: number }[] = [];
    for (let t = markLength; t < video.duration; t += markLength) {
      major.push({ time: t, pct: (t / video.duration) * 100 });
    }

    const maxTicks = Math.max(20, Math.floor((trackWidth || 600) / 8));
    const rawTickInterval = markLength / 5;
    const tickInterval =
      video.duration / rawTickInterval > maxTicks
        ? video.duration / maxTicks
        : rawTickInterval;
    const ticks: number[] = [];
    for (let t = tickInterval; t < video.duration; t += tickInterval) {
      ticks.push((t / video.duration) * 100);
    }

    return { major, ticks };
  }, [video.duration, trackWidth]);

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
          } else {
            setCursorCurrent(
              snapToNearestSegmentBoundary(segments, time, cursorStart),
            );
          }
        }}
        onMouseMove={(e) => {
          const time = getTimeFromEvent(e);
          const seg = findSegmentAt(segments, time);
          const newHoveredId = seg?.id ?? null;
          if (newHoveredId !== hoveredSegmentId)
            setHoveredSegmentId(newHoveredId);
          if (hasMultipleSegments && seg && seg.id !== selectedSegmentId) {
            selectSegment(seg.id);
          }
        }}
        onMouseLeave={() => {
          setHoveredSegmentId(null);
        }}
        onPointerMove={(e) => {
          if (!segDrag.current) return;
          const { startX, startTime, segId, type, edge, endTime } =
            segDrag.current;
          const dx = e.clientX - startX;

          // Dead zone: don't commit to drag until pointer moves past threshold
          if (!handleDrag.current && Math.abs(dx) < 3) return;
          handleDrag.current = true;

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
        <div className="relative timeline-marks w-full">
          {marks.ticks.map((pct, i) => (
            <span
              key={`t${i}`}
              className="absolute bottom-0 w-px h-1.5 bg-muted-foreground/25 -translate-x-1/2"
              style={{ left: `${pct}%` }}
            />
          ))}
          {marks.major.map(({ time, pct }) => (
            <span
              key={time}
              className="absolute top-1 -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${pct}%` }}
            >
              {secondsToDuration(time, {
                compact: video.duration < 3600,
                trimLeft: isMobile,
              })}
            </span>
          ))}
        </div>

        <div ref={trackRef} className="relative h-16">
          {/* Segment highlights */}
          {segments.map((seg, i) => {
            const segStartPct = seg.sourceStart / video.duration;
            const segEndPct = seg.sourceEnd / video.duration;
            const isSelected = seg.id === selectedSegmentId;
            const isHovered = seg.id === hoveredSegmentId;
            const segWidthPx = (segEndPct - segStartPct) * trackWidth;
            const isDragging = segDrag.current !== null;
            const canJoin =
              hasMultipleSegments &&
              ((i > 0 &&
                Math.abs(
                  segments[i - 1].sourceEnd - seg.sourceStart,
                ) <= FLUSH_TOLERANCE) ||
                (i < segments.length - 1 &&
                  Math.abs(
                    seg.sourceEnd - segments[i + 1].sourceStart,
                  ) <= FLUSH_TOLERANCE));

            return (
              <Fragment key={seg.id}>
                <div
                  className={cn(
                    "absolute h-16 -top-1 z-10 pointer-events-auto cursor-grab",
                    !isDragging && "transition-colors duration-150",
                    isHovered ? "bg-primary/25" : "bg-primary/20",
                  )}
                  style={{
                    left: segStartPct * trackWidth,
                    width: segWidthPx,
                  }}
                  onPointerDown={(e) => {
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
                  }}
                >
                  {/* Segment actions (top-right) */}
                  {(isMobile || isHovered || isSelected) &&
                    hasMultipleSegments && (
                      <div className="absolute top-0.5 right-0.5 pointer-events-auto z-20 flex items-center gap-1.5">
                        <TooltipProvider>
                          {canJoin && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="cursor-pointer text-primary hover:text-primary/80"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    joinSegment(seg.id);
                                  }}
                                >
                                  <Merge className="h-3.5 w-3.5" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  Join adjacent segments into one
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="cursor-pointer text-destructive hover:text-destructive/80"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSegment(seg.id);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Delete segment</p>
                              </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}
                  {/* Resize handles — visible on hover, offset vertically to avoid overlap */}
                  {(isMobile || isHovered || isSelected) && (
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
            <div className="w-0.5 h-14 bg-primary rounded-full -translate-x-1/2 shadow-[0_0_6px_hsl(var(--primary)/0.4)]" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoTimeline;
