import { useAppStore } from "@/store.tsx";
import { Input } from "../ui/input";
import React from "react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

const VideoExportOptions = () => {
  const {
    video,
    cursorStart,
    setCursorStart,
    cursorEnd,
    setCursorEnd,
    cropRectangle,
    setCropRectangle,
  } = useAppStore();

  if (!video) {
    return;
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="text-md font-medium leading-none flex justify-between">
          Trim
          <Button
            variant="link"
            className={cn(
              "text-xs h-min p-0 invisible",
              (cursorStart > 0 || cursorEnd < video.duration) && "visible",
            )}
            onClick={() => {
              setCursorStart(0);
              setCursorEnd(video.duration);
            }}
          >
            Reset
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="flex flex-col gap-1">
            <span className={"flex items-center gap-1 text-primary text-sm"}>
              Start
            </span>
            <div className="flex flex-row gap-1 items-center">
              <Input
                type="number"
                value={cursorStart}
                step={0.1}
                min={0}
                max={cursorEnd - 1}
                onChange={(e) => {
                  let value = +e.currentTarget.value;
                  if (value > cursorEnd - 1) {
                    value = cursorEnd - 1;
                  }

                  setCursorStart(value);
                }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className={"flex items-center gap-1 text-primary text-sm"}>
              End
            </span>
            <div className="flex flex-row gap-1 items-center">
              <Input
                type="number"
                value={cursorEnd}
                step={0.1}
                min={cursorStart + 1}
                max={video.duration}
                onChange={(e) => {
                  let value = +e.currentTarget.value;
                  if (value > video.duration) {
                    value = video.duration;
                  }

                  setCursorEnd(value);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 mt-4">
        <div className="text-md font-medium leading-none flex justify-between">
          Crop
          <Button
            variant="link"
            className={cn(
              "text-xs h-min p-0 invisible",
              (cropRectangle.w > 0 || cropRectangle.h > 0) && "visible",
            )}
            onClick={() => {
              setCropRectangle({ x: 0, y: 0, w: 0, h: 0, vw: 0, vh: 0 });
            }}
          >
            Reset
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="flex flex-col gap-1">
            <span className={"flex items-center gap-1 text-primary text-sm"}>
              x
            </span>
            <div className="flex flex-row gap-1 items-center">
              <Input
                type="number"
                value={cropRectangle.x}
                min={0}
                onChange={(e) => {
                  let value = +e.currentTarget.value;
                  if (value < 0) {
                    value = 0;
                  }

                  setCropRectangle({ ...cropRectangle, x: value });
                }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className={"flex items-center gap-1 text-primary text-sm"}>
              y
            </span>
            <div className="flex flex-row gap-1 items-center">
              <Input
                type="number"
                value={cropRectangle.y}
                min={0}
                onChange={(e) => {
                  let value = +e.currentTarget.value;
                  if (value < 0) {
                    value = 0;
                  }

                  setCropRectangle({ ...cropRectangle, y: value });
                }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className={"flex items-center gap-1 text-primary text-sm"}>
              Width
            </span>
            <div className="flex flex-row gap-1 items-center">
              <Input
                type="number"
                value={cropRectangle.w}
                onChange={(e) => {
                  const value = +e.currentTarget.value;

                  setCropRectangle({ ...cropRectangle, w: value });
                }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className={"flex items-center gap-1 text-primary text-sm"}>
              Height
            </span>
            <div className="flex flex-row gap-1 items-center">
              <Input
                type="number"
                value={cropRectangle.h}
                onChange={(e) => {
                  const value = +e.currentTarget.value;

                  setCropRectangle({ ...cropRectangle, h: value });
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default VideoExportOptions;
