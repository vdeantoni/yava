import { describe, test, expect } from "vitest";
import {
  clamp,
  MIN_SLICE_DISTANCE,
  sliceIndexAt,
  secondsToDuration,
  durationToSeconds,
  describeMediaError,
} from "./utils";

describe("clamp", () => {
  test("holds a value inside the range", () => {
    // A pointer dragged past either end of the player or the timeline.
    expect(clamp(-5, 400)).toBe(0);
    expect(clamp(500, 400)).toBe(400);
    expect(clamp(200, 400)).toBe(200);
  });
});

describe("secondsToDuration", () => {
  test("formats zero", () => {
    expect(secondsToDuration(0)).toBe("00:00:00");
  });

  test("formats seconds only", () => {
    expect(secondsToDuration(45)).toBe("00:00:45");
  });

  test("formats minutes and seconds", () => {
    expect(secondsToDuration(125)).toBe("00:02:05");
  });

  test("formats hours, minutes, seconds", () => {
    expect(secondsToDuration(3661)).toBe("01:01:01");
  });

  test("includes milliseconds when ms option is true", () => {
    expect(secondsToDuration(1.5, { ms: true })).toBe("00:00:01:500");
  });

  test("trims leading zeros when trimLeft is true", () => {
    expect(secondsToDuration(45, { trimLeft: true })).toBe("45");
  });

  test("trims with minutes present", () => {
    expect(secondsToDuration(125, { trimLeft: true })).toBe("02:05");
  });

  test("compact format omits hours", () => {
    expect(secondsToDuration(125, { compact: true })).toBe("02:05");
  });

  test("compact with ms", () => {
    expect(secondsToDuration(1.5, { ms: true, compact: true })).toBe(
      "00:01:500",
    );
  });

  test("compact formats zero", () => {
    expect(secondsToDuration(0, { compact: true })).toBe("00:00");
  });
});

describe("durationToSeconds", () => {
  test("parses HH:MM:SS", () => {
    expect(durationToSeconds("01:02:03")).toBe(3723);
  });

  test("parses HH:MM:SS:mmm with milliseconds", () => {
    expect(durationToSeconds("00:00:01:500")).toBe(1.5);
  });

  test("parses MM:SS:mmm compact format", () => {
    expect(durationToSeconds("02:05:500")).toBe(125.5);
  });

  test("parses MM:SS compact format", () => {
    expect(durationToSeconds("02:05")).toBe(125);
  });

  test("parses zero duration", () => {
    expect(durationToSeconds("00:00:00")).toBe(0);
  });

  test("roundtrips with secondsToDuration", () => {
    const seconds = 3723;
    expect(durationToSeconds(secondsToDuration(seconds))).toBe(seconds);
  });

  test("roundtrips with milliseconds", () => {
    const seconds = 1.5;
    expect(durationToSeconds(secondsToDuration(seconds, { ms: true }))).toBe(
      seconds,
    );
  });

  test("roundtrips compact with milliseconds", () => {
    const seconds = 125.5;
    expect(
      durationToSeconds(
        secondsToDuration(seconds, { ms: true, compact: true }),
      ),
    ).toBe(seconds);
  });
});

describe("describeMediaError", () => {
  test("blames the network for a network error", () => {
    expect(describeMediaError(2)).toMatch(/connection/i);
  });

  test("points at the pixel format for a decode failure", () => {
    for (const code of [3, 4]) {
      expect(describeMediaError(code)).toMatch(/cannot decode/i);
      expect(describeMediaError(code)).toMatch(/10-bit/);
    }
  });

  test("assumes an unsupported codec when the element reports no code", () => {
    // Chromium fires error with a null MediaError for a codec it cannot use.
    expect(describeMediaError(undefined)).toMatch(/cannot decode/i);
  });

  test("says so when loading was interrupted", () => {
    expect(describeMediaError(1)).toMatch(/interrupted/i);
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
