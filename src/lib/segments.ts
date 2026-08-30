import { clampFades } from "./fade";
import {
  findSegmentAt,
  snapToNearestSegmentBoundary,
  FLUSH_TOLERANCE,
  MIN_SLICE_DISTANCE,
  type SegmentLike,
} from "./utils";

/**
 * Queries and invariants over the segment list.
 *
 * The store owns the list; this owns what has to stay true of it. Keeping the
 * rules here means the toolbar can ask the same question the reducer answers,
 * rather than each spelling it out and drifting.
 */

export interface CommittedSegments<T extends SegmentLike> {
  segments: T[];
  cursorStart: number;
  cursorEnd: number;
  cursorCurrent: number;
}

/**
 * The one door every segment write goes through.
 *
 * It sorts, mirrors the outer bounds onto the cursors, clamps each segment's
 * fades, and snaps the cursor to the nearest boundary when the edit has
 * stranded it in a gap. None of that is expressible in the type, so a mutation
 * that skips the door gets it wrong silently.
 *
 * Disjointness is the one list invariant left to the caller: `updateSegmentBounds`
 * clamps against its neighbours, and nothing here would catch an overlap.
 */
export function commitSegments<T extends SegmentLike>(
  segments: T[],
  cursorCurrent: number,
): CommittedSegments<T> {
  const committed = segments
    .map(clampFades)
    .sort((a, b) => a.sourceStart - b.sourceStart);

  const cursorStart = committed[0].sourceStart;

  return {
    segments: committed,
    cursorStart,
    cursorEnd: committed[committed.length - 1].sourceEnd,
    cursorCurrent: findSegmentAt(committed, cursorCurrent)
      ? cursorCurrent
      : snapToNearestSegmentBoundary(committed, cursorCurrent, cursorStart),
  };
}

/**
 * Index of the segment a slice at `time` would split, or -1 when none would.
 *
 * The store acts on the index and the toolbar only asks whether there is one,
 * so both go through here rather than each spelling out the rule.
 */
export function sliceIndexAt(segments: SegmentLike[], time: number): number {
  return segments.findIndex(
    (s) =>
      time > s.sourceStart + MIN_SLICE_DISTANCE &&
      time < s.sourceEnd - MIN_SLICE_DISTANCE,
  );
}

/**
 * Inclusive bounds of the run of flush-adjacent segments around `index`, which
 * is what a join would swallow. A run of one has nothing to join.
 *
 * The store merges the run and the timeline decides whether to offer the
 * button, so both ask here.
 */
export function flushRunAt(
  segments: SegmentLike[],
  index: number,
): [number, number] {
  const flush = (a: SegmentLike, b: SegmentLike) =>
    Math.abs(a.sourceEnd - b.sourceStart) <= FLUSH_TOLERANCE;

  let start = index;
  while (start > 0 && flush(segments[start - 1], segments[start])) start--;

  let end = index;
  while (end < segments.length - 1 && flush(segments[end], segments[end + 1])) {
    end++;
  }

  return [start, end];
}
