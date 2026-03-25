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

// HH:MM:SS:mmm → 4 sections
const FULL_SECTIONS = {
  ranges: [
    { start: 0, end: 2 },
    { start: 3, end: 5 },
    { start: 6, end: 8 },
    { start: 9, end: 12 },
  ],
  max: [99, 59, 59, 999],
  msPadIdx: 3,
} as const;

// MM:SS:mmm → 3 sections
const COMPACT_SECTIONS = {
  ranges: [
    { start: 0, end: 2 },
    { start: 3, end: 5 },
    { start: 6, end: 9 },
  ],
  max: [59, 59, 999],
  msPadIdx: 2,
} as const;

type SectionConfig = typeof FULL_SECTIONS | typeof COMPACT_SECTIONS;

function getSectionIndex(cursorPos: number, config: SectionConfig): number {
  for (let i = config.ranges.length - 1; i >= 0; i--) {
    if (cursorPos >= config.ranges[i].start) return i;
  }
  return 0;
}

function stepDurationSection(
  value: string,
  sectionIdx: number,
  delta: number,
  config: SectionConfig,
): string {
  const parts = value.split(":");
  const current = parseInt(parts[sectionIdx] || "0", 10);
  const next = Math.max(
    0,
    Math.min(config.max[sectionIdx], current + delta),
  );
  const padLen = sectionIdx === config.msPadIdx ? 3 : 2;
  parts[sectionIdx] = String(next).padStart(padLen, "0");
  return parts.join(":");
}

const COMPACT_THRESHOLD = 45 * 60;

const DurationInput = ({
  value,
  onChange,
  onCommit,
  readOnly,
  compact,
}: {
  value: string;
  onChange?: (value: string) => void;
  onCommit?: (value: string) => void;
  readOnly?: boolean;
  compact?: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const config = compact ? COMPACT_SECTIONS : FULL_SECTIONS;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const cursorPos = e.currentTarget.selectionStart ?? 0;
    const sectionIdx = getSectionIndex(cursorPos, config);
    const delta = e.key === "ArrowUp" ? 1 : -1;
    const formatted = stepDurationSection(value, sectionIdx, delta, config);
    onChange?.(formatted);
    onCommit?.(formatted);
    const range = config.ranges[sectionIdx];
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
    cursorEnd,
    segments,
    selectedSegmentId,
    selectSegment,
    updateSegmentBounds,
    resetCursors,
  } = useAppStore();

  const [trimStart, setTrimStart] = useState("");
  const [trimEnd, setTrimEnd] = useState("");

  const compact = !!video && video.duration < COMPACT_THRESHOLD;
  const durationOpts = { ms: true, compact } as const;

  useEffect(() => {
    setTrimStart(secondsToDuration(cursorStart, durationOpts));
    setTrimEnd(secondsToDuration(cursorEnd, durationOpts));
  }, [cursorStart, cursorEnd, compact]);

  if (!video) return null;

  const hasTrim = cursorStart > 0 || cursorEnd < video.duration;
  const hasMultipleSegments = segments.length > 1;

  const activeSegment = hasMultipleSegments
    ? (segments.find((s) => s.id === selectedSegmentId) ?? null)
    : null;

  const applyTrimStart = (formatted: string) => {
    const value = durationToSeconds(formatted);
    updateSegmentBounds(segments[0].id, value, segments[0].sourceEnd);
  };

  const applyTrimEnd = (formatted: string) => {
    const value = durationToSeconds(formatted);
    updateSegmentBounds(segments[0].id, segments[0].sourceStart, value);
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
            compact={compact}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">End</label>
          <DurationInput
            value={trimEnd}
            onChange={setTrimEnd}
            onCommit={applyTrimEnd}
            compact={compact}
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
      compact={compact}
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
  compact,
  selectSegment,
  updateSegmentBounds,
  resetCursors,
}: {
  video: HTMLVideoElement;
  segments: Segment[];
  activeSegment: Segment | null;
  compact: boolean;
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

  const durationOpts = { ms: true, compact } as const;

  useEffect(() => {
    if (activeSegment) {
      setSegStart(
        secondsToDuration(activeSegment.sourceStart, durationOpts),
      );
      setSegEnd(
        secondsToDuration(activeSegment.sourceEnd, durationOpts),
      );
    }
  }, [activeSegment?.id, activeSegment?.sourceStart, activeSegment?.sourceEnd, compact]);

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
              compact={compact}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">End</label>
            <DurationInput
              value={segEnd}
              onChange={setSegEnd}
              onCommit={applySegEnd}
              compact={compact}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              Segment Duration
            </label>
            <DurationInput
              value={secondsToDuration(segDuration, durationOpts)}
              readOnly
            />
          </div>
        </>
      )}

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
