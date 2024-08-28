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
import { cn, isMobile, secondsToDuration } from "@/lib/utils.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card.tsx";
import { range } from "lodash";

export const STEP_SIZE = 0.1;

const TICKS = 100;
const TOTAL_MARKS = 10;

const MARK_OPTIONS = [
  1, 5, 10, 15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 420, 480, 540, 600,
  660, 720, 780, 840, 900, 960,
];

const TRACK_RESIZE_OBSERVER_DEBOUNCE_TIME = 200;

const useTrackResizeObserver = (ref: RefObject<HTMLDivElement>) => {
  const [{ width }, setSize] = useState({
    width: 0,
  });

  const onResize = useDebounceCallback(({ width }) => {
    if (!width) {
      return;
    }

    setSize({ width });
  }, TRACK_RESIZE_OBSERVER_DEBOUNCE_TIME);

  useResizeObserver({
    ref,
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
  } = useAppStore();

  const trackRef = useRef<HTMLDivElement>(null);
  const trackWidth = useTrackResizeObserver(trackRef);

  const leftThumb = useRef<HTMLInputElement>(null);
  const rightThumb = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCursorStart(0);
    setCursorEnd(video.duration);
    setCursorCurrent(0);
  }, [video]);

  useEffect(() => {
    if (cursorCurrent < cursorStart) {
      setCursorCurrent(cursorStart);
    }

    if (cursorCurrent > cursorEnd) {
      setCursorCurrent(cursorEnd);
    }
  }, [cursorStart, cursorEnd, cursorCurrent, trackWidth]);

  const marks = useMemo(() => {
    let markLength = MARK_OPTIONS[0];
    for (let i = 0; i < MARK_OPTIONS.length; i++) {
      markLength = MARK_OPTIONS[i];

      if (Math.ceil(video.duration / TOTAL_MARKS) <= MARK_OPTIONS[i]) {
        break;
      }
    }

    const marks: { [percentage: number]: number } = {};
    for (let i = 0; i < video.duration / markLength; i++) {
      marks[Math.floor((i * markLength * TICKS) / video.duration)] =
        markLength * i;
    }

    return marks;
  }, [video.duration]);

  return (
    <>
      <Card className={"border-0"}>
        <CardHeader>
          <CardDescription>
            <span className={cn("flex items-center justify-center")}>
              <span className="duration-start mr-1">
                {secondsToDuration(video.currentTime || 0)}
              </span>
              <span className="duration-end">
                /{" "}
                {secondsToDuration(
                  cursorEnd < video.duration ? cursorEnd : video.duration,
                )}
              </span>
              {cursorStart > 0 && (
                <span className="duration-trim ml-1">
                  {" "}
                  ({secondsToDuration(cursorEnd - cursorStart)})
                </span>
              )}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col cursor-default">
            <div
              className="flex flex-col gap-2"
              onClick={(e) => {
                const { width, left } = e.currentTarget.getBoundingClientRect();
                const percentage = (e.clientX - left) / width;
                const time = percentage * video.duration;

                setCursorCurrent(time);
              }}
            >
              <div className="grid grid-flow-col timeline-marks w-full overflow-hidden">
                {range(TICKS).map((i) => (
                  <Fragment key={i}>
                    <span className="relative">
                      <span
                        className={
                          "absolute top-0 left-0 transform -translate-x-[50%]"
                        }
                      >
                        {i && marks[i]
                          ? secondsToDuration(marks[i], isMobile)
                          : ""}
                      </span>
                    </span>
                    <span className={"mt-2"}>{"."}</span>
                  </Fragment>
                ))}
              </div>

              <div ref={trackRef} className="relative h-16">
                {(cursorStart > 0 ||
                  +cursorEnd.toFixed(1) < +video.duration.toFixed(1)) && (
                  <div
                    className="pointer-events-none absolute trim-area"
                    style={{
                      left:
                        (cursorStart / video.duration) * trackWidth -
                        (cursorStart / video.duration) * 16,
                      width:
                        (cursorEnd / video.duration -
                          cursorStart / video.duration) *
                          trackWidth +
                        (1 - cursorEnd / video.duration) * 16 +
                        (cursorStart / video.duration) * 16,
                    }}
                  ></div>
                )}

                <VideoThumbnails trackWidth={trackWidth} />

                <input
                  ref={leftThumb}
                  className="slider-thumb-left"
                  type="range"
                  min="0"
                  max={video.duration}
                  step={STEP_SIZE}
                  value={cursorStart}
                  onClick={(e) => e.stopPropagation()}
                  onInput={(e) => {
                    const value = +e.currentTarget.value;
                    if (value < cursorEnd - 1) {
                      setCursorStart(+e.currentTarget.value);
                    }
                  }}
                />
                <input
                  ref={rightThumb}
                  className="slider-thumb-right"
                  type="range"
                  min="0"
                  max={video.duration}
                  step={STEP_SIZE}
                  value={cursorEnd}
                  onClick={(e) => e.stopPropagation()}
                  onInput={(e) => {
                    const value = +e.currentTarget.value;
                    if (value > cursorStart + 1) {
                      let newValue = +e.currentTarget.value;
                      if (video.duration - newValue <= STEP_SIZE) {
                        newValue = video.duration;
                      }

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
                  onInput={(e) => {
                    const value = +e.currentTarget.value;
                    if (value >= cursorStart && value <= cursorEnd) {
                      setCursorCurrent(+e.currentTarget.value);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default VideoTimeline;
