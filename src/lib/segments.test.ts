import { describe, test, expect } from "vitest";
import { commitSegments, flushRunAt, sliceIndexAt } from "./segments";
import { FLUSH_TOLERANCE, MIN_SLICE_DISTANCE, type SegmentLike } from "./utils";

const seg = (
  sourceStart: number,
  sourceEnd: number,
  fades: Partial<SegmentLike> = {},
): SegmentLike => ({ sourceStart, sourceEnd, ...fades });

describe("commitSegments", () => {
  test("mirrors the outer bounds onto the cursors", () => {
    const { cursorStart, cursorEnd } = commitSegments(
      [seg(2, 8), seg(12, 30)],
      5,
    );
    expect(cursorStart).toBe(2);
    expect(cursorEnd).toBe(30);
  });

  test("sorts, so the mirrors come off the real outer bounds", () => {
    const { segments, cursorStart, cursorEnd } = commitSegments(
      [seg(12, 30), seg(2, 8)],
      5,
    );
    expect(segments.map((s) => s.sourceStart)).toEqual([2, 12]);
    expect(cursorStart).toBe(2);
    expect(cursorEnd).toBe(30);
  });

  test("leaves a cursor that is inside a segment alone", () => {
    expect(commitSegments([seg(0, 10), seg(20, 30)], 25).cursorCurrent).toBe(
      25,
    );
  });

  test("snaps a cursor stranded in a gap to the nearest boundary", () => {
    expect(commitSegments([seg(0, 10), seg(20, 30)], 12).cursorCurrent).toBe(
      10,
    );
    expect(commitSegments([seg(0, 10), seg(20, 30)], 18).cursorCurrent).toBe(
      20,
    );
  });

  test("snaps a cursor left outside the edit entirely", () => {
    expect(commitSegments([seg(5, 10)], 40).cursorCurrent).toBe(10);
  });

  test("cuts back a fade the segment can no longer hold", () => {
    const { segments } = commitSegments([seg(0, 2, { fadeIn: 8 })], 1);
    expect(segments[0].fadeIn).toBe(2);
  });

  test("hands back untouched segments unchanged, references and all", () => {
    // The store calls this on every write, including per pointer move.
    const untouched = seg(0, 10, { fadeIn: 2 });
    expect(commitSegments([untouched], 5).segments[0]).toBe(untouched);
  });
});

describe("flushRunAt", () => {
  test("a lone segment is its own run", () => {
    expect(flushRunAt([seg(0, 10)], 0)).toEqual([0, 0]);
  });

  test("a segment with a gap either side is its own run", () => {
    const segments = [seg(0, 5), seg(10, 15), seg(20, 25)];
    expect(flushRunAt(segments, 1)).toEqual([1, 1]);
  });

  test("walks both ways across flush neighbours", () => {
    const segments = [seg(0, 5), seg(5, 10), seg(10, 15)];
    expect(flushRunAt(segments, 1)).toEqual([0, 2]);
  });

  test("stops at the first gap on each side", () => {
    const segments = [seg(0, 5), seg(8, 12), seg(12, 16), seg(20, 24)];
    expect(flushRunAt(segments, 2)).toEqual([1, 2]);
  });

  test("treats a boundary within the tolerance as flush", () => {
    const segments = [seg(0, 5), seg(5 + FLUSH_TOLERANCE / 2, 10)];
    expect(flushRunAt(segments, 0)).toEqual([0, 1]);
  });

  test("treats a boundary past the tolerance as a gap", () => {
    const segments = [seg(0, 5), seg(5 + FLUSH_TOLERANCE * 2, 10)];
    expect(flushRunAt(segments, 0)).toEqual([0, 0]);
  });
});

describe("sliceIndexAt", () => {
  const seg = (sourceStart: number, sourceEnd: number) => ({
    sourceStart,
    sourceEnd,
  });

  test("finds the segment a slice would split", () => {
    expect(sliceIndexAt([seg(0, 10)], 5)).toBe(0);
  });

  test("picks the segment the time falls in", () => {
    expect(sliceIndexAt([seg(0, 10), seg(10, 20)], 15)).toBe(1);
  });

  test("refuses a slice that would leave a sliver at either edge", () => {
    const half = MIN_SLICE_DISTANCE / 2;
    expect(sliceIndexAt([seg(0, 10)], half)).toBe(-1);
    expect(sliceIndexAt([seg(0, 10)], 10 - half)).toBe(-1);
  });

  test("refuses a segment with no room to slice at all", () => {
    expect(sliceIndexAt([seg(0, MIN_SLICE_DISTANCE)], 0.25)).toBe(-1);
  });

  test("refuses a time in a gap", () => {
    expect(sliceIndexAt([seg(0, 5), seg(10, 20)], 7)).toBe(-1);
  });

  test("refuses a cut, which is an edge of both its segments", () => {
    expect(sliceIndexAt([seg(0, 10), seg(10, 20)], 10)).toBe(-1);
  });
});
