import { describe, it, expect } from "vitest";
import { draggedSegmentBounds, timeAtX, timePerPixel } from "./timeline";

const seg = (sourceStart: number, sourceEnd: number) => ({
  sourceStart,
  sourceEnd,
});

describe("timePerPixel", () => {
  it("divides the duration across the track", () => {
    expect(timePerPixel(600, 60)).toBe(0.1);
  });

  it("returns zero before the track has been measured", () => {
    // The width arrives from a debounced resize observer, so it starts at 0 and
    // a naive division would hand back Infinity.
    expect(timePerPixel(0, 60)).toBe(0);
    expect(timePerPixel(600, 0)).toBe(0);
  });
});

describe("timeAtX", () => {
  const rect = { left: 100, width: 400 };

  it("maps a position across the track to a time", () => {
    expect(timeAtX(100, rect, 60)).toBe(0);
    expect(timeAtX(300, rect, 60)).toBe(30);
    expect(timeAtX(500, rect, 60)).toBe(60);
  });

  it("survives an unmeasured track", () => {
    expect(timeAtX(300, { left: 0, width: 0 }, 60)).toBe(0);
  });
});

describe("draggedSegmentBounds", () => {
  const duration = 60;

  /** The common case: the drag started where the segment currently sits. */
  const drag = (
    segments: { sourceStart: number; sourceEnd: number }[],
    index: number,
    delta: number,
    total = duration,
  ) => draggedSegmentBounds(segments, index, segments[index], delta, total);

  it("shifts a lone segment by the delta", () => {
    expect(drag([seg(10, 20)], 0, 5)).toEqual({
      sourceStart: 15,
      sourceEnd: 25,
    });
  });

  it("measures the delta from where the drag started, not where the segment is", () => {
    // Every pointer move reports the delta from the pointer's own start, so
    // feeding the already-moved segment back in would re-apply the whole shift.
    const moved = [seg(15, 25)];
    expect(draggedSegmentBounds(moved, 0, seg(10, 20), 5, duration)).toEqual({
      sourceStart: 15,
      sourceEnd: 25,
    });
  });

  it("shifts backwards too", () => {
    expect(drag([seg(10, 20)], 0, -4)).toEqual({
      sourceStart: 6,
      sourceEnd: 16,
    });
  });

  it("keeps the length when it hits the start of the video", () => {
    expect(drag([seg(10, 20)], 0, -50)).toEqual({
      sourceStart: 0,
      sourceEnd: 10,
    });
  });

  it("keeps the length when it hits the end of the video", () => {
    expect(drag([seg(10, 20)], 0, 100)).toEqual({
      sourceStart: 50,
      sourceEnd: 60,
    });
  });

  it("stops against the previous segment instead of overlapping it", () => {
    const segments = [seg(0, 10), seg(20, 30)];
    expect(drag(segments, 1, -15)).toEqual({
      sourceStart: 10,
      sourceEnd: 20,
    });
  });

  it("stops against the next segment instead of overlapping it", () => {
    const segments = [seg(0, 10), seg(20, 30), seg(40, 50)];
    expect(drag(segments, 1, 15)).toEqual({
      sourceStart: 30,
      sourceEnd: 40,
    });
  });

  it("does not move a segment wedged between two neighbours", () => {
    const segments = [seg(0, 10), seg(10, 20), seg(20, 30)];
    expect(drag(segments, 1, 5)).toEqual({
      sourceStart: 10,
      sourceEnd: 20,
    });
    expect(drag(segments, 1, -5)).toEqual({
      sourceStart: 10,
      sourceEnd: 20,
    });
  });

  it("prefers the neighbour over the video bound when both apply", () => {
    const segments = [seg(0, 30), seg(40, 50)];
    expect(drag(segments, 1, -100)).toEqual({
      sourceStart: 30,
      sourceEnd: 40,
    });
  });

  it("never returns a negative start, even for a segment longer than the video", () => {
    expect(drag([seg(0, 90)], 0, 20, 60).sourceStart).toBe(0);
  });
});
