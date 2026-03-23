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
import { isMobile, secondsToDuration } from "@/lib/utils.ts";

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
    setCursorStart,
    setCursorEnd,
    setCursorCurrent,
    resetCursors,
  } = useAppStore(
    useShallow((s) => ({
      video: s.video,
      cursorStart: s.cursorStart,
      cursorEnd: s.cursorEnd,
      cursorCurrent: s.cursorCurrent,
      setCursorStart: s.setCursorStart,
      setCursorEnd: s.setCursorEnd,
      setCursorCurrent: s.setCursorCurrent,
      resetCursors: s.resetCursors,
    })),
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const handleDrag = useRef(false);
  const trackWidth = useTrackResizeObserver(trackRef);

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

  const startPct = cursorStart / video.duration;
  const endPct = cursorEnd / video.duration;
  const isTrimmed =
    cursorStart > 0 || Math.abs(cursorEnd - video.duration) > 0.05;

  return (
    <div className="border-t border-border bg-card px-2 lg:px-4 py-1">
      <div
        className="flex flex-col gap-1 cursor-default"
        onClick={(e) => {
          if (handleDrag.current) {
            handleDrag.current = false;
            return;
          }
          video.pause();
          const { width, left } = e.currentTarget.getBoundingClientRect();
          const percentage = (e.clientX - left) / width;
          const time = Math.max(
            cursorStart,
            Math.min(cursorEnd, percentage * video.duration),
          );

          setCursorCurrent(time);
        }}
      >
        <div className="grid grid-flow-col timeline-marks w-full overflow-hidden">
          {tickMarks}
        </div>

        <div ref={trackRef} className="relative h-16">
          {isTrimmed && (
            <div
              className="pointer-events-none absolute trim-area"
              style={{
                left: startPct * trackWidth - startPct * HANDLE_WIDTH,
                width:
                  (endPct - startPct) * trackWidth +
                  (1 - endPct) * HANDLE_WIDTH +
                  startPct * HANDLE_WIDTH,
              }}
            ></div>
          )}

          <VideoThumbnails trackWidth={trackWidth} />

          <input
            className="slider-thumb-left"
            type="range"
            min="0"
            max={video.duration}
            step={STEP_SIZE}
            value={cursorStart}
            onPointerDown={onHandlePointerDown}
            onClick={onHandleClick}
            onInput={(e) => {
              const value = +e.currentTarget.value;
              if (value < cursorEnd - 1) {
                setCursorStart(value);
              }
            }}
          />
          <input
            className="slider-thumb-right"
            type="range"
            min="0"
            max={video.duration}
            step={STEP_SIZE}
            value={cursorEnd}
            onPointerDown={onHandlePointerDown}
            onClick={onHandleClick}
            onInput={(e) => {
              const value = +e.currentTarget.value;
              if (value > cursorStart + 1) {
                const newValue =
                  video.duration - value <= STEP_SIZE ? video.duration : value;
                setCursorEnd(newValue);
              }
            }}
          />
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
                setCursorCurrent(value);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default VideoTimeline;
