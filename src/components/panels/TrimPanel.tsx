import { useAppStore, type Segment } from "@/store.tsx";
import { useEffect, useState } from "react";
import { durationToSeconds, secondsToDuration } from "@/lib/utils.ts";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";

const TrimPanel = () => {
  const {
    video,
    cursorStart,
    setCursorStart,
    cursorEnd,
    setCursorEnd,
    segments,
    selectedSegmentId,
    selectSegment,
    updateSegmentBounds,
    resetCursors,
  } = useAppStore();

  const [trimStart, setTrimStart] = useState("");
  const [trimEnd, setTrimEnd] = useState("");

  useEffect(() => {
    setTrimStart(secondsToDuration(cursorStart, { ms: true }));
    setTrimEnd(secondsToDuration(cursorEnd, { ms: true }));
  }, [cursorStart, cursorEnd]);

  if (!video) return null;

  const effectiveDuration = segments.reduce(
    (sum, seg) => sum + (seg.sourceEnd - seg.sourceStart),
    0,
  );
  const hasTrim = cursorStart > 0 || cursorEnd < video.duration;
  const hasMultipleSegments = segments.length > 1;

  // Multi-segment: active segment for editing (null when nothing selected)
  const activeSegment = hasMultipleSegments
    ? (segments.find((s) => s.id === selectedSegmentId) ?? null)
    : null;

  // Single-segment mode
  if (!hasMultipleSegments) {
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
          <label className="text-xs text-muted-foreground">
            Output Duration
          </label>
          <div className="font-mono text-sm text-foreground h-8 flex items-center px-3 rounded-md bg-background border border-border">
            {secondsToDuration(effectiveDuration, { ms: true })}
          </div>
        </div>

        {hasTrim && (
          <Button
            variant="link"
            className="text-xs h-min p-0 text-primary self-end"
            onClick={() => resetCursors(video.duration)}
          >
            Reset
          </Button>
        )}
      </div>
    );
  }

  // Multi-segment mode
  return (
    <MultiSegmentPanel
      video={video}
      segments={segments}
      activeSegment={activeSegment}
      effectiveDuration={effectiveDuration}
      selectSegment={selectSegment}
      updateSegmentBounds={updateSegmentBounds}
      resetCursors={resetCursors}
    />
  );
};

const MultiSegmentPanel = ({
  video,
  segments,
  activeSegment,
  effectiveDuration,
  selectSegment,
  updateSegmentBounds,
  resetCursors,
}: {
  video: HTMLVideoElement;
  segments: Segment[];
  activeSegment: Segment | null;
  effectiveDuration: number;
  selectSegment: (id: string | null) => void;
  updateSegmentBounds: (
    id: string,
    sourceStart: number,
    sourceEnd: number,
  ) => void;
  resetCursors: (duration: number) => void;
}) => {
  const [segStart, setSegStart] = useState("");
  const [segEnd, setSegEnd] = useState("");

  useEffect(() => {
    if (activeSegment) {
      setSegStart(
        secondsToDuration(activeSegment.sourceStart, { ms: true }),
      );
      setSegEnd(secondsToDuration(activeSegment.sourceEnd, { ms: true }));
    }
  }, [activeSegment?.id, activeSegment?.sourceStart, activeSegment?.sourceEnd]);

  const segDuration = activeSegment
    ? activeSegment.sourceEnd - activeSegment.sourceStart
    : 0;

  return (
    <div className="flex flex-col gap-3 px-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Segment</label>
        <Select
          value={activeSegment?.id ?? ""}
          onValueChange={(id) => selectSegment(id)}
        >
          <SelectTrigger className="h-8 text-sm bg-background">
            <SelectValue placeholder="Select a segment..." />
          </SelectTrigger>
          <SelectContent>
            {segments.map((seg, i) => (
              <SelectItem key={seg.id} value={seg.id}>
                Segment {i + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activeSegment && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Start</label>
            <Input
              type="text"
              className="font-mono text-sm h-8 bg-background"
              value={segStart}
              onChange={(e) => setSegStart(e.currentTarget.value)}
              onBlur={() => {
                const value = durationToSeconds(segStart);
                updateSegmentBounds(
                  activeSegment.id,
                  value,
                  activeSegment.sourceEnd,
                );
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">End</label>
            <Input
              type="text"
              className="font-mono text-sm h-8 bg-background"
              value={segEnd}
              onChange={(e) => setSegEnd(e.currentTarget.value)}
              onBlur={() => {
                const value = durationToSeconds(segEnd);
                updateSegmentBounds(
                  activeSegment.id,
                  activeSegment.sourceStart,
                  value,
                );
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              Segment Duration
            </label>
            <div className="font-mono text-sm text-foreground h-8 flex items-center px-3 rounded-md bg-background border border-border">
              {secondsToDuration(segDuration, { ms: true })}
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">
          Output Duration
        </label>
        <div className="font-mono text-sm text-foreground h-8 flex items-center px-3 rounded-md bg-background border border-border">
          {secondsToDuration(effectiveDuration, { ms: true })}
        </div>
      </div>

      <Button
        variant="link"
        className="text-xs h-min p-0 text-primary self-end"
        onClick={() => resetCursors(video.duration)}
      >
        Reset
      </Button>
    </div>
  );
};

export default TrimPanel;
