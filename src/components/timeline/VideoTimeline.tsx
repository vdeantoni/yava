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
      resetCursors: s.resetCursors,
    })),
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const handleDrag = useRef(false);
  const trackWidth = useTrackResizeObserver(trackRef);

  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);

  const onHandlePointerDown = () => {
    handleDrag.current = true;
  };
  const onHandleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleDrag.current = false;
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
        }}
        onMouseLeave={() => setHoveredSegmentId(null)}
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

            return (
              <Fragment key={seg.id}>
                <div
                  className={cn(
                    "pointer-events-none absolute h-16 -top-1 z-10 transition-colors",
                    isSelected
                      ? "bg-primary/30 ring-1 ring-inset ring-primary"
                      : "bg-primary/20",
                  )}
                  style={{
                    left: segStartPct * trackWidth,
                    width: segWidthPx,
                  }}
                >
                  {/* Checkbox for segment selection (hover or selected) */}
                  {hasMultipleSegments &&
                    (isHovered || isSelected) &&
                    segWidthPx > 24 && (
                      <div
                        className="absolute top-0.5 right-0.5 pointer-events-auto z-20"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectSegment(isSelected ? null : seg.id);
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          className="h-3.5 w-3.5"
                        />
                      </div>
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
