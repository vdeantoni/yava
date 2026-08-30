import { describe, it, expect } from "vitest";
import {
  draggedSegmentBounds,
  playheadTimeAt,
  timeAtX,
  timelineMarks,
  timePerPixel,
  xAtTime,
} from "./timeline";

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

describe("timelineMarks", () => {
  it("spaces labelled marks across the duration", () => {
    const { major } = timelineMarks(60, 1200);
    expect(major.map((m) => m.time)).toEqual([
      5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55,
    ]);
  });

  it("positions marks as percentages, not pixels", () => {
    const { major } = timelineMarks(60, 1200);
    expect(major[0].pct).toBeCloseTo((5 / 60) * 100);
  });

  it("widens the interval as the track gets narrower", () => {
    const wide = timelineMarks(600, 1600).major.length;
    const narrow = timelineMarks(600, 300).major.length;
    expect(narrow).toBeLessThan(wide);
  });

  it("subdivides each labelled mark with ticks", () => {
    const { major, ticks } = timelineMarks(60, 1200);
    expect(ticks.length).toBeGreaterThan(major.length);
  });

  it("caps the ticks a very long video can ask for", () => {
    // Past the largest interval the scale falls back to one second, which for
    // four hours would be fourteen thousand nodes without the cap.
    const { ticks } = timelineMarks(4 * 3600, 1200);
    expect(ticks.length).toBeLessThanOrEqual(150);
  });

  it("has no ruler to draw before the duration is known", () => {
    expect(timelineMarks(0, 1200)).toEqual({ major: [], ticks: [] });
  });

  it("falls back to an assumed width before the track is measured", () => {
    expect(timelineMarks(60, 0).major.length).toBeGreaterThan(0);
  });
});

describe("xAtTime", () => {
  it("places a time along the track", () => {
    expect(xAtTime(30, 60, 600)).toBe(300);
  });

  it("round-trips with timeAtX", () => {
    const rect = { left: 32, width: 600 };
    const x = xAtTime(18, 60, rect.width) + rect.left;
    expect(timeAtX(x, rect, 60)).toBeCloseTo(18);
  });

  it("has nowhere to place anything without a duration", () => {
    expect(xAtTime(30, 0, 600)).toBe(0);
  });
});

describe("playheadTimeAt", () => {
  it("leaves a time that lands inside a segment alone", () => {
    expect(playheadTimeAt([seg(0, 10)], 4)).toBe(4);
  });

  it("snaps out of a gap to the nearer edge", () => {
    const segments = [seg(0, 10), seg(20, 30)];
    expect(playheadTimeAt(segments, 12)).toBe(10);
    expect(playheadTimeAt(segments, 18)).toBe(20);
  });

  it("follows a drag past the end to the end, rather than stopping short", () => {
    // The distinction the e2e cannot see: a rule that ignored out-of-range
    // times would leave the playhead wherever the last in-range sample was.
    expect(playheadTimeAt([seg(0, 2)], 7.5)).toBe(2);
  });

  it("follows a drag before the edit back to its start", () => {
    expect(playheadTimeAt([seg(5, 10)], 0)).toBe(5);
  });

  it("falls back when there is nothing to snap to", () => {
    expect(playheadTimeAt([], 4, 1.5)).toBe(1.5);
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
