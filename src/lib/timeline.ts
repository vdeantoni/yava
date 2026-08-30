import type { SegmentLike } from "./utils";

/** Below this a pointer has not committed to a drag yet. */
export const DRAG_DEAD_ZONE_PX = 3;

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
