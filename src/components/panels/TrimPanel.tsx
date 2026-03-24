import { useAppStore, type Segment } from "@/store.tsx";
import { useEffect, useRef, useState } from "react";
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

// Format: HH:MM:SS:mmm → sections at char positions 0-1, 3-4, 6-7, 9-11
const SECTION_RANGES = [
  { start: 0, end: 2 }, // hours
  { start: 3, end: 5 }, // minutes
  { start: 6, end: 8 }, // seconds
  { start: 9, end: 12 }, // milliseconds
] as const;

const SECTION_MAX = [99, 59, 59, 999] as const;

function getSectionIndex(cursorPos: number): number {
  for (let i = SECTION_RANGES.length - 1; i >= 0; i--) {
    if (cursorPos >= SECTION_RANGES[i].start) return i;
  }
  return 0;
}

function stepDurationSection(
  value: string,
  sectionIdx: number,
  delta: number,
): string {
  const parts = value.split(":");
  const current = parseInt(parts[sectionIdx] || "0", 10);
  const next = Math.max(0, Math.min(SECTION_MAX[sectionIdx], current + delta));
  const padLen = sectionIdx === 3 ? 3 : 2;
  parts[sectionIdx] = String(next).padStart(padLen, "0");
  return parts.join(":");
}

const DurationInput = ({
  value,
  onChange,
  onCommit,
  readOnly,
}: {
  value: string;
  onChange?: (value: string) => void;
  onCommit?: (value: string) => void;
  readOnly?: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const cursorPos = e.currentTarget.selectionStart ?? 0;
    const sectionIdx = getSectionIndex(cursorPos);
    const delta = e.key === "ArrowUp" ? 1 : -1;
    const formatted = stepDurationSection(value, sectionIdx, delta);
    onChange?.(formatted);
    onCommit?.(formatted);
    // Restore cursor to the same section after React re-renders
    const range = SECTION_RANGES[sectionIdx];
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(range.start, range.end);
    });
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      className="font-mono text-sm h-8 bg-background"
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.currentTarget.value)}
      onKeyDown={readOnly ? undefined : handleKeyDown}
      onBlur={readOnly ? undefined : () => onCommit?.(value)}
    />
  );
};

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

  const applyTrimStart = (formatted: string) => {
    let value = durationToSeconds(formatted);
    if (value > cursorEnd - 1) value = cursorEnd - 1;
    if (value < 0) value = 0;
    setCursorStart(value);
  };

  const applyTrimEnd = (formatted: string) => {
    let value = durationToSeconds(formatted);
    if (value < cursorStart + 1) value = cursorStart + 1;
    setCursorEnd(value);
  };

  // Single-segment mode
  if (!hasMultipleSegments) {
    return (
      <div className="flex flex-col gap-3 px-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Start</label>
          <DurationInput
            value={trimStart}
            onChange={setTrimStart}
            onCommit={applyTrimStart}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">End</label>
          <DurationInput
            value={trimEnd}
            onChange={setTrimEnd}
            onCommit={applyTrimEnd}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            Output Duration
          </label>
          <DurationInput
            value={secondsToDuration(effectiveDuration, { ms: true })}
            readOnly
          />
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

  const applySegStart = (formatted: string) => {
    if (!activeSegment) return;
    const value = durationToSeconds(formatted);
    updateSegmentBounds(activeSegment.id, value, activeSegment.sourceEnd);
  };

  const applySegEnd = (formatted: string) => {
    if (!activeSegment) return;
    const value = durationToSeconds(formatted);
    updateSegmentBounds(activeSegment.id, activeSegment.sourceStart, value);
  };

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
            <DurationInput
              value={segStart}
              onChange={setSegStart}
              onCommit={applySegStart}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">End</label>
            <DurationInput
              value={segEnd}
              onChange={setSegEnd}
              onCommit={applySegEnd}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              Segment Duration
            </label>
            <DurationInput
              value={secondsToDuration(segDuration, { ms: true })}
              readOnly
            />
          </div>
        </>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">
          Output Duration
        </label>
        <DurationInput
          value={secondsToDuration(effectiveDuration, { ms: true })}
          readOnly
        />
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
