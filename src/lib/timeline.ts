import { findSegmentAt, snapToNearestSegmentBoundary } from "./utils";
import type { SegmentLike } from "./utils";

/** Below this a pointer has not committed to a drag yet. */
export const DRAG_DEAD_ZONE_PX = 3;

/** Closest two labelled marks may sit before the scale steps up. */
const MIN_MARK_SPACING_PX = 80;

/** Mark intervals worth showing, in seconds. */
const MARK_OPTIONS = [
  1, 5, 10, 15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 420, 480, 540, 600,
  660, 720, 780, 840, 900, 960,
];

/** Width to assume before the track has been measured. */
const ASSUMED_TRACK_WIDTH = 600;

export interface TimelineMarks {
  /** Labelled marks, as a time and a percentage across the track. */
  major: { time: number; pct: number }[];
  /** Unlabelled ticks, as percentages across the track. */
  ticks: number[];
}

/**
 * The ruler for a track of `trackWidth` pixels showing `duration` seconds.
 *
 * Positions come out as percentages, so they survive a resize between the
 * measurement and the paint. A duration longer than the largest interval falls
 * back to the smallest, which is why the tick count is capped: without it, four
 * hours at one-second marks is fourteen thousand nodes.
 */
export function timelineMarks(
  duration: number,
  trackWidth: number,
): TimelineMarks {
  const width = trackWidth || ASSUMED_TRACK_WIDTH;
  if (!duration) return { major: [], ticks: [] };

  const totalMarks = Math.max(2, Math.floor(width / MIN_MARK_SPACING_PX));
  const markLength =
    MARK_OPTIONS.find((opt) => Math.ceil(duration / totalMarks) <= opt) ??
    MARK_OPTIONS[0];

  const major: TimelineMarks["major"] = [];
  for (let t = markLength; t < duration; t += markLength) {
    major.push({ time: t, pct: (t / duration) * 100 });
  }

  const maxTicks = Math.max(20, Math.floor(width / 8));
  const rawTickInterval = markLength / 5;
  const tickInterval =
    duration / rawTickInterval > maxTicks
      ? duration / maxTicks
      : rawTickInterval;

  const ticks: number[] = [];
  for (let t = tickInterval; t < duration; t += tickInterval) {
    ticks.push((t / duration) * 100);
  }

  return { major, ticks };
}

/** Seconds per pixel of track, for turning a pointer delta into a time delta. */
export function timePerPixel(trackWidth: number, duration: number): number {
  if (!trackWidth || !duration) return 0;
  return duration / trackWidth;
}

/** The time a click at `clientX` lands on. */
export function timeAtX(
  clientX: number,
  rect: { left: number; width: number },
  duration: number,
): number {
  if (!rect.width) return 0;
  return ((clientX - rect.left) / rect.width) * duration;
}

/** Where along the track a time sits, in pixels. The inverse of `timeAtX`. */
export function xAtTime(
  time: number,
  duration: number,
  trackWidth: number,
): number {
  if (!duration) return 0;
  return (time / duration) * trackWidth;
}

/**
 * Where the playhead goes for a pointer at `time`: there, or the nearest
 * boundary when that lands in a gap or outside the edit.
 *
 * Both the track and the playhead's own drag resolve a raw pointer time, and
 * they have to agree, or clicking and dragging to the same pixel park the
 * playhead in different places.
 */
export function playheadTimeAt(
  segments: SegmentLike[],
  time: number,
  fallback = 0,
): number {
  return findSegmentAt(segments, time)
    ? time
    : snapToNearestSegmentBoundary(segments, time, fallback);
}

/**
 * Where a dragged segment lands: `origin` shifted by `delta`, kept its original
 * length, and stopped by the video bounds and by its neighbours rather than
 * sliding through them.
 *
 * `origin` is the segment's position when the drag started, not its current
 * one, because `delta` is measured from the pointer's own start. Feeding the
 * live position back in would re-apply the whole delta on every move.
 */
export function draggedSegmentBounds(
  segments: SegmentLike[],
  index: number,
  origin: SegmentLike,
  delta: number,
  duration: number,
): { sourceStart: number; sourceEnd: number } {
  const length = origin.sourceEnd - origin.sourceStart;

  let start = origin.sourceStart + delta;
  let end = origin.sourceEnd + delta;

  const shiftTo = (newStart: number) => {
    start = newStart;
    end = newStart + length;
  };

  if (start < 0) shiftTo(0);
  if (end > duration) shiftTo(Math.max(0, duration - length));

  const previous = segments[index - 1];
  const next = segments[index + 1];
  if (previous && start < previous.sourceEnd) shiftTo(previous.sourceEnd);
  if (next && end > next.sourceStart) shiftTo(next.sourceStart - length);

  return { sourceStart: start, sourceEnd: end };
}
