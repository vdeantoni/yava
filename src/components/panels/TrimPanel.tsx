import { useAppStore } from "@/store.tsx";
import { useEffect, useState } from "react";
import { durationToSeconds, secondsToDuration } from "@/lib/utils.ts";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";

const TrimPanel = () => {
  const { video, cursorStart, setCursorStart, cursorEnd, setCursorEnd } =
    useAppStore();

  const [trimStart, setTrimStart] = useState("");
  const [trimEnd, setTrimEnd] = useState("");

  useEffect(() => {
    setTrimStart(secondsToDuration(cursorStart, { ms: true }));
    setTrimEnd(secondsToDuration(cursorEnd, { ms: true }));
  }, [cursorStart, cursorEnd]);

  if (!video) return null;

  const duration = cursorEnd - cursorStart;
  const hasTrim = cursorStart > 0 || cursorEnd < video.duration;

  return (
    <div className="flex flex-col gap-3 px-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Start</label>
        <Input
          type="text"
          className="font-mono text-sm h-8 bg-background"
          value={trimStart}
          onChange={(e) => setTrimStart(e.currentTarget.value)}
          onBlur={() => {
            let value = durationToSeconds(trimStart);
            if (value > cursorEnd - 1) value = cursorEnd - 1;
            if (value < 0) value = 0;
            setCursorStart(value);
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">End</label>
        <Input
          type="text"
          className="font-mono text-sm h-8 bg-background"
          value={trimEnd}
          onChange={(e) => setTrimEnd(e.currentTarget.value)}
          onBlur={() => {
            let value = durationToSeconds(trimEnd);
            if (value < cursorStart + 1) value = cursorStart + 1;
            setCursorEnd(value);
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Duration</label>
        <div className="font-mono text-sm text-foreground h-8 flex items-center px-3 rounded-md bg-background border border-border">
          {secondsToDuration(duration, { ms: true })}
        </div>
      </div>

      {hasTrim && (
        <Button
          variant="link"
          className="text-xs h-min p-0 text-primary self-end"
          onClick={() => {
            setCursorStart(0);
            setCursorEnd(video.duration);
          }}
        >
          Reset
        </Button>
      )}
    </div>
  );
};

export default TrimPanel;
