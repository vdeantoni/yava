import { describe, test, expect } from "vitest";
import {
  clampFades,
  fadeFilters,
  fadeGainAt,
  fadeIntent,
  withFade,
} from "./fade";
import { MIN_FADE_DURATION, type SegmentLike } from "./utils";

const seg = (
  sourceStart: number,
  sourceEnd: number,
  fades: Partial<SegmentLike> = {},
): SegmentLike => ({ sourceStart, sourceEnd, ...fades });

describe("fadeIntent", () => {
  test("measures a fade in from the start of the segment", () => {
    expect(fadeIntent([seg(0, 10)], 3, "in")).toEqual({
      index: 0,
      duration: 3,
    });
  });

  test("measures a fade out back from the end of the segment", () => {
    expect(fadeIntent([seg(0, 10)], 8, "out")).toEqual({
      index: 0,
      duration: 2,
    });
  });

  test("measures against the segment's own start, not the timeline's", () => {
    expect(fadeIntent([seg(4, 10)], 6, "in")).toEqual({
      index: 0,
      duration: 2,
    });
  });

  test("has nothing to fade in at the very start of a segment", () => {
    expect(fadeIntent([seg(0, 10)], 0, "in")).toBeNull();
  });

  test("has nothing to fade out at the very end of a segment", () => {
    expect(fadeIntent([seg(0, 10)], 10, "out")).toBeNull();
  });

  test("refuses a fade shorter than the minimum", () => {
    const tooClose = MIN_FADE_DURATION / 2;
    expect(fadeIntent([seg(0, 10)], tooClose, "in")).toBeNull();
    expect(fadeIntent([seg(0, 10)], 10 - tooClose, "out")).toBeNull();
  });

  test("fades the whole segment when the playhead is on its far edge", () => {
    expect(fadeIntent([seg(0, 10)], 10, "in")).toEqual({
      index: 0,
      duration: 10,
    });
    expect(fadeIntent([seg(0, 10)], 0, "out")).toEqual({
      index: 0,
      duration: 10,
    });
  });

  test("on a shared cut, fades in the segment that ends there", () => {
    const segments = [seg(0, 5), seg(5, 10)];
    expect(fadeIntent(segments, 5, "in")).toEqual({ index: 0, duration: 5 });
  });

  test("on a shared cut, fades out the segment that starts there", () => {
    const segments = [seg(0, 5), seg(5, 10)];
    expect(fadeIntent(segments, 5, "out")).toEqual({ index: 1, duration: 5 });
  });

  test("finds the right segment among several", () => {
    const segments = [seg(0, 5), seg(8, 20)];
    expect(fadeIntent(segments, 12, "in")).toEqual({ index: 1, duration: 4 });
  });

  test("has no target in a gap between segments", () => {
    const segments = [seg(0, 5), seg(8, 20)];
    expect(fadeIntent(segments, 6, "in")).toBeNull();
    expect(fadeIntent(segments, 6, "out")).toBeNull();
  });

  test("has no target without segments", () => {
    expect(fadeIntent([], 3, "in")).toBeNull();
  });

  test("clears the fade from anywhere inside the segment", () => {
    const segments = [seg(0, 10, { fadeIn: 3 })];
    expect(fadeIntent(segments, 3, "in")).toEqual({ index: 0, duration: 0 });
    expect(fadeIntent(segments, 8, "in")).toEqual({ index: 0, duration: 0 });
  });

  test("clears even where there would be no room to set one", () => {
    // Nothing to fade in at the very start, but the fade already there can go.
    const segments = [seg(0, 10, { fadeIn: 3 })];
    expect(fadeIntent(segments, 0, "in")).toEqual({ index: 0, duration: 0 });
  });

  test("clears only the segment under the playhead", () => {
    const segments = [seg(0, 5, { fadeIn: 2 }), seg(5, 10)];
    expect(fadeIntent(segments, 8, "in")).toEqual({ index: 1, duration: 3 });
  });

  test("reads the fade of its own kind, not the other one", () => {
    const segments = [seg(0, 10, { fadeOut: 3 })];
    expect(fadeIntent(segments, 3, "in")).toEqual({ index: 0, duration: 3 });
  });
});

describe("withFade", () => {
  test("sets the requested fade and leaves the other alone", () => {
    const s = withFade(seg(0, 10, { fadeOut: 2 }), "in", 3);
    expect(s).toEqual({
      sourceStart: 0,
      sourceEnd: 10,
      fadeIn: 3,
      fadeOut: 2,
    });
  });

  test("removes the fade when the duration is zero", () => {
    const s = withFade(seg(0, 10, { fadeIn: 3 }), "in", 0);
    expect(s.fadeIn).toBeUndefined();
  });

  test("does not mutate the segment it was given", () => {
    const original = seg(0, 10);
    withFade(original, "out", 4);
    expect(original.fadeOut).toBeUndefined();
  });
});

describe("clampFades", () => {
  test("hands back the same segment when the fades already fit", () => {
    // commitSegments maps this over the whole list on every write.
    const original = seg(0, 10, { fadeIn: 3, fadeOut: 2 });
    expect(clampFades(original)).toBe(original);
  });

  test("cuts a fade back to the length of the segment", () => {
    expect(clampFades(seg(0, 2, { fadeIn: 5 })).fadeIn).toBe(2);
  });

  test("drops a fade the segment can no longer hold", () => {
    const clamped = clampFades(seg(0, MIN_FADE_DURATION / 2, { fadeIn: 5 }));
    expect(clamped.fadeIn).toBeUndefined();
  });

  test("drops nonsense lengths that came in from a URL", () => {
    expect(clampFades(seg(0, 10, { fadeIn: -1 })).fadeIn).toBeUndefined();
    expect(clampFades(seg(0, 10, { fadeOut: NaN })).fadeOut).toBeUndefined();
  });
});

describe("fadeFilters", () => {
  test("is empty without fades", () => {
    expect(fadeFilters({ duration: 10 })).toEqual([]);
  });

  test("starts a fade in at the head of the segment", () => {
    expect(fadeFilters({ duration: 10, fadeIn: 1.5 })).toEqual([
      "fade=t=in:st=0:d=1.500",
    ]);
  });

  test("offsets a fade out so it lands on the last frame", () => {
    expect(fadeFilters({ duration: 10, fadeOut: 2 })).toEqual([
      "fade=t=out:st=8.000:d=2.000",
    ]);
  });

  test("emits both, in order", () => {
    expect(fadeFilters({ duration: 10, fadeIn: 1, fadeOut: 2 })).toEqual([
      "fade=t=in:st=0:d=1.000",
      "fade=t=out:st=8.000:d=2.000",
    ]);
  });

  test("uses afade for audio", () => {
    expect(
      fadeFilters({ duration: 10, fadeIn: 1, fadeOut: 2 }, "afade"),
    ).toEqual(["afade=t=in:st=0:d=1.000", "afade=t=out:st=8.000:d=2.000"]);
  });

  test("never starts a fade out before the segment does", () => {
    expect(fadeFilters({ duration: 1, fadeOut: 5 })).toEqual([
      "fade=t=out:st=0.000:d=5.000",
    ]);
  });
});

describe("fadeGainAt", () => {
  test("is full where no fade is set", () => {
    expect(fadeGainAt([seg(0, 10)], 5)).toBe(1);
  });

  test("holds a fade out past the end of its segment", () => {
    // Playback overshoots a cut by a frame or two before it is stopped.
    expect(fadeGainAt([seg(0, 5, { fadeOut: 2 })], 5.2)).toBe(0);
  });

  test("holds nothing where the segment it left had no fade out", () => {
    expect(fadeGainAt([seg(0, 5, { fadeIn: 2 })], 5.2)).toBe(1);
  });

  test("is full before the first segment starts", () => {
    expect(fadeGainAt([seg(4, 10, { fadeIn: 2 })], 1)).toBe(1);
  });

  test("is black and silent on the first frame of a fade in", () => {
    expect(fadeGainAt([seg(0, 10, { fadeIn: 2 })], 0)).toBe(0);
  });

  test("is black and silent on the last frame of a fade out", () => {
    expect(fadeGainAt([seg(0, 10, { fadeOut: 2 })], 10)).toBe(0);
  });

  test("ramps linearly across the fade", () => {
    expect(fadeGainAt([seg(0, 10, { fadeIn: 2 })], 0.5)).toBeCloseTo(0.25);
    expect(fadeGainAt([seg(0, 10, { fadeIn: 2 })], 1)).toBeCloseTo(0.5);
    expect(fadeGainAt([seg(0, 10, { fadeIn: 2 })], 2)).toBe(1);
  });

  test("measures from the segment's own edges", () => {
    expect(fadeGainAt([seg(4, 10, { fadeIn: 2 })], 5)).toBeCloseTo(0.5);
  });

  test("multiplies overlapping fades, the way chained filters do", () => {
    const segments = [seg(0, 4, { fadeIn: 4, fadeOut: 4 })];
    // Half faded up and half faded down.
    expect(fadeGainAt(segments, 2)).toBeCloseTo(0.25);
  });
});
