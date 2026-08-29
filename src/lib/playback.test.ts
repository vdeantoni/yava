import { describe, it, expect } from "vitest";
import { nextPlaybackAction } from "./playback";
import { PLAYBACK_TOLERANCE } from "./utils";

const seg = (sourceStart: number, sourceEnd: number) => ({
  sourceStart,
  sourceEnd,
});

/** One 30s segment covering the whole video. */
const FULL = [seg(0, 30)];
/** Two flush segments: one slice at 10s. */
const ONE_SLICE = [seg(0, 10), seg(10, 30)];
/** Three flush segments: slices at 10s and 20s. */
const TWO_SLICES = [seg(0, 10), seg(10, 20), seg(20, 30)];
/** Middle segment deleted: a real gap between 10s and 20s. */
const WITH_GAP = [seg(0, 10), seg(20, 30)];

describe("nextPlaybackAction", () => {
  it("keeps playing inside a segment", () => {
    expect(nextPlaybackAction(FULL, 5)).toEqual({ type: "continue" });
    expect(nextPlaybackAction(TWO_SLICES, 15)).toEqual({ type: "continue" });
  });

  it("stops at the end of the last segment", () => {
    expect(nextPlaybackAction(FULL, 30)).toEqual({ type: "stop", time: 30 });
    expect(nextPlaybackAction(TWO_SLICES, 29.98)).toEqual({
      type: "stop",
      time: 30,
    });
    // Past the end (the source runs longer than the edit)
    expect(nextPlaybackAction([seg(0, 20)], 25)).toEqual({
      type: "stop",
      time: 20,
    });
  });

  it("seeks forward when the playhead is before the first segment", () => {
    expect(nextPlaybackAction([seg(5, 30)], 0)).toEqual({
      type: "seek",
      time: 5,
    });
  });

  it("plays through a slice instead of seeking to where it already is", () => {
    for (const t of [9.96, 9.99, 10, 10.01, 10.04]) {
      expect(nextPlaybackAction(ONE_SLICE, t)).toEqual({ type: "continue" });
      expect(nextPlaybackAction(TWO_SLICES, t)).toEqual({ type: "continue" });
    }
    for (const t of [19.96, 20, 20.04]) {
      expect(nextPlaybackAction(TWO_SLICES, t)).toEqual({ type: "continue" });
    }
  });

  it("never seeks to a time it is already at", () => {
    for (const segments of [FULL, ONE_SLICE, TWO_SLICES, WITH_GAP]) {
      for (let t = 0; t <= 30; t += 0.01) {
        const action = nextPlaybackAction(segments, t);
        if (action.type === "seek") {
          expect(Math.abs(action.time - t)).toBeGreaterThan(PLAYBACK_TOLERANCE);
        }
      }
    }
  });

  it("skips a gap left by a deleted segment", () => {
    expect(nextPlaybackAction(WITH_GAP, 9.97)).toEqual({
      type: "seek",
      time: 20,
    });
    expect(nextPlaybackAction(WITH_GAP, 14)).toEqual({
      type: "seek",
      time: 20,
    });
  });

  it("treats a frame-snapped landing just short of a segment start as inside it", () => {
    // Seeking to 20 can land a hair earlier; that must not re-trigger the jump.
    expect(nextPlaybackAction(WITH_GAP, 19.98)).toEqual({ type: "continue" });
  });

  it("handles a gap narrower than the playback tolerance", () => {
    const narrow = [seg(0, 10), seg(10.02, 30)];
    expect(nextPlaybackAction(narrow, 9.96)).toEqual({
      type: "seek",
      time: 10.02,
    });
    expect(nextPlaybackAction(narrow, 10.02)).toEqual({ type: "continue" });
  });

  it("does nothing without segments", () => {
    expect(nextPlaybackAction([], 3)).toEqual({ type: "continue" });
  });
});
