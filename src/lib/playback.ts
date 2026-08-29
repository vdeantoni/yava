import { PLAYBACK_TOLERANCE, type SegmentLike } from "./utils";

export type PlaybackAction =
  /** Let the media element keep running. */
  | { type: "continue" }
  /** Jump the playhead forward over a gap, or back to the first segment. */
  | { type: "seek"; time: number }
  /** End of the edit: pause and park the playhead. */
  | { type: "stop"; time: number };

/**
 * Decide what playback should do at `time`, given sorted, non-overlapping segments.
 *
 * A time on a cut shared by two flush segments belongs to the later one.
 * Resolving it to the earlier one would end that segment and seek to a position
 * the playhead already holds, and the seek's own timeupdate would repeat the
 * decision forever.
 */
export function nextPlaybackAction(
  segments: SegmentLike[],
  time: number,
): PlaybackAction {
  if (segments.length === 0) return { type: "continue" };

  const last = segments[segments.length - 1];
  if (time >= last.sourceEnd - PLAYBACK_TOLERANCE) {
    return { type: "stop", time: last.sourceEnd };
  }

  const index = segments.findLastIndex(
    (s) => time >= s.sourceStart - PLAYBACK_TOLERANCE,
  );

  if (index === -1) return { type: "seek", time: segments[0].sourceStart };

  if (time >= segments[index].sourceEnd - PLAYBACK_TOLERANCE) {
    return { type: "seek", time: segments[index + 1].sourceStart };
  }

  return { type: "continue" };
}
