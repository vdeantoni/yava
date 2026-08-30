import { describe, test, expect } from "vitest";
import { clamp, secondsToDuration, durationToSeconds } from "./utils";

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
