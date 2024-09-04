import { useAppStore } from "@/store.tsx";
import { useEffect, useState } from "react";
import { cn, durationToSeconds, secondsToDuration } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

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

  const [trimStart, setTrimStart] = useState("");
  const [trimEnd, setTrimEnd] = useState("");

  useEffect(() => {
    setTrimStart(secondsToDuration(cursorStart, { ms: true }));
  }, [cursorStart]);

  useEffect(() => {
    setTrimEnd(secondsToDuration(cursorEnd, { ms: true }));
  }, [cursorEnd]);

  if (!video) {
    return;
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <Card className={"border-0"}>
        <CardHeader>
          <CardDescription>
            <span className="text-md font-medium leading-none flex justify-between">
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
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            <div className="grid gap-2">
              <div className="flex flex-col gap-1">
                <span
                  className={"flex items-center gap-1 text-primary text-sm"}
                >
                  Start
                </span>
                <div className="flex flex-row gap-1 items-center">
                  <Input
                    type="text"
                    pattern="[0-9]{1,2}:[0-9]{1,2}:[0-9]{1,2}:[0-9]{1,3}"
                    value={trimStart}
                    onChange={(e) => {
                      setTrimStart(e.currentTarget.value);
                    }}
                    onBlur={() => {
                      let value = durationToSeconds(trimStart);
                      if (value > cursorEnd - 1) {
                        value = cursorEnd - 1;
                      }

                      setCursorStart(value);
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span
                  className={"flex items-center gap-1 text-primary text-sm"}
                >
                  End
                </span>
                <div className="flex flex-row gap-1 items-center">
                  <Input
                    type="text"
                    pattern="[0-9]{1,2}:[0-9]{1,2}:[0-9]{1,2}:[0-9]{1,3}"
                    value={trimEnd}
                    onChange={(e) => {
                      setTrimEnd(e.currentTarget.value);
                    }}
                    onBlur={() => {
                      let value = durationToSeconds(trimEnd);
                      if (value < cursorStart + 1) {
                        value = cursorStart + 1;
                      }

                      setCursorEnd(value);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={"border-0"}>
        <CardHeader>
          <CardDescription>
            <span className="text-md font-medium leading-none flex justify-between">
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
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span
                  className={"flex items-center gap-1 text-primary text-sm"}
                >
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
                <span
                  className={"flex items-center gap-1 text-primary text-sm"}
                >
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
                <span
                  className={"flex items-center gap-1 text-primary text-sm"}
                >
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
                <span
                  className={"flex items-center gap-1 text-primary text-sm"}
                >
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
        </CardContent>
      </Card>
    </div>
  );
};

export default VideoExportOptions;
