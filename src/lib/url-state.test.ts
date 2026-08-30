import { describe, test, expect } from "vitest";
import { encodeEditState, decodeEditState } from "./url-state";
import type { UrlEditState } from "@/store";

/** Full-duration single segment on a 60s video, every export option default. */
function state(overrides: Partial<Parameters<typeof encodeEditState>[0]> = {}) {
  return {
    sourceUrl: null,
    segments: [{ sourceStart: 0, sourceEnd: 60 }],
    cursorStart: 0,
    cursorEnd: 60,
    format: "mp4",
    preset: "ultrafast",
    frameRate: 30,
    speed: 1,
    noAudio: false,
    ...overrides,
  };
}

/** Decode straight back, for asserting what actually survives a round trip. */
function roundTrip(
  overrides: Partial<Parameters<typeof encodeEditState>[0]> = {},
): UrlEditState | null {
  const encoded = encodeEditState(state(overrides));
  return encoded === null ? null : decodeEditState(encoded);
}

describe("encodeEditState", () => {
  test("returns null when nothing differs from the defaults", () => {
    expect(encodeEditState(state())).toBeNull();
  });

  test("omits the default full-duration segment", () => {
    expect(
      roundTrip({ sourceUrl: "https://ex.com/a.mp4" })?.seg,
    ).toBeUndefined();
  });

  test("encodes segments once they differ from the default", () => {
    expect(
      roundTrip({ segments: [{ sourceStart: 5, sourceEnd: 20 }] })?.seg,
    ).toEqual([[5, 20]]);
  });

  test("encodes multiple segments in order", () => {
    const decoded = roundTrip({
      segments: [
        { sourceStart: 0, sourceEnd: 10 },
        { sourceStart: 25, sourceEnd: 40 },
      ],
      cursorEnd: 40,
    });
    expect(decoded?.seg).toEqual([
      [0, 10],
      [25, 40],
    ]);
  });

  test("treats a trimmed start as non-default even at full length", () => {
    // sourceStart !== 0 fails the default check regardless of the cursors.
    expect(
      roundTrip({
        segments: [{ sourceStart: 2, sourceEnd: 60 }],
        cursorStart: 2,
      })?.seg,
    ).toEqual([[2, 60]]);
  });

  test("rounds segment bounds to milliseconds", () => {
    expect(
      roundTrip({
        segments: [{ sourceStart: 1.23456789, sourceEnd: 9.87654321 }],
      })?.seg,
    ).toEqual([[1.235, 9.877]]);
  });

  test("carries fades in a longer tuple, and only when one is set", () => {
    expect(
      roundTrip({
        segments: [{ sourceStart: 0, sourceEnd: 60, fadeIn: 1.5 }],
      })?.seg,
    ).toEqual([[0, 60, 1.5, 0]]);
  });

  test("a fade alone makes the default segment worth encoding", () => {
    // Bounds untouched, so without the fade this would encode to nothing.
    expect(
      encodeEditState(
        state({ segments: [{ sourceStart: 0, sourceEnd: 60, fadeOut: 2 }] }),
      ),
    ).not.toBeNull();
  });

  test("keeps the short tuple when neither fade is set", () => {
    expect(
      roundTrip({ segments: [{ sourceStart: 5, sourceEnd: 20 }] })?.seg,
    ).toEqual([[5, 20]]);
  });

  test("includes only the export options that differ from the default", () => {
    expect(roundTrip({ format: "webm" })).toEqual({ fmt: "webm" });
    expect(roundTrip({ preset: "slow" })).toEqual({ pre: "slow" });
    expect(roundTrip({ frameRate: 60 })).toEqual({ fps: 60 });
    expect(roundTrip({ speed: 2 })).toEqual({ spd: 2 });
    expect(roundTrip({ noAudio: true })).toEqual({ na: true });
  });

  test("omits noAudio when false rather than encoding it", () => {
    expect(
      roundTrip({ sourceUrl: "https://ex.com/a.mp4", noAudio: false })?.na,
    ).toBeUndefined();
  });

  test("carries the source URL", () => {
    expect(roundTrip({ sourceUrl: "https://ex.com/a.mp4" })?.v).toBe(
      "https://ex.com/a.mp4",
    );
  });

  test("produces a URL-safe payload with no base64 padding", () => {
    const encoded = encodeEditState(
      state({ sourceUrl: "https://ex.com/some/longer/path/video.mp4" }),
    );
    expect(encoded).not.toBeNull();
    expect(encoded).not.toMatch(/[+/=]/);
  });
});

describe("decodeEditState", () => {
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  test("survives a full round trip", () => {
    const decoded = roundTrip({
      sourceUrl: "https://ex.com/a.mp4",
      segments: [
        { sourceStart: 1.5, sourceEnd: 10 },
        { sourceStart: 20, sourceEnd: 30.25 },
      ],
      cursorEnd: 30.25,
      format: "webm",
      preset: "slow",
      frameRate: 24,
      speed: 1.5,
      noAudio: true,
    });

    expect(decoded).toEqual({
      v: "https://ex.com/a.mp4",
      seg: [
        [1.5, 10],
        [20, 30.25],
      ],
      fmt: "webm",
      pre: "slow",
      fps: 24,
      spd: 1.5,
      na: true,
    });
  });

  // Hashes arrive from untrusted URLs, so every one of these must be swallowed
  // rather than thrown, or a hand-edited link crashes the app on load.
  test.each([
    ["not base64 at all", "!!!!not-base64!!!!"],
    ["valid base64 that is not JSON", btoa("hello there")],
    ["JSON null", encode(null)],
    ["JSON number", encode(42)],
    ["JSON string", encode("nope")],
    ["empty string", ""],
  ])("returns null for %s", (_label, hash) => {
    expect(decodeEditState(hash)).toBeNull();
  });

  test("returns null for an object with no recognised keys", () => {
    expect(decodeEditState(encode({ nonsense: true, other: 1 }))).toBeNull();
  });

  test("drops fields whose type is wrong", () => {
    const decoded = decodeEditState(
      encode({
        v: 123,
        fmt: 456,
        pre: [],
        fps: "60",
        spd: null,
        na: "yes",
      }),
    );
    expect(decoded).toBeNull();
  });

  test("keeps valid fields alongside invalid ones", () => {
    expect(decodeEditState(encode({ fps: 60, spd: "fast", na: 1 }))).toEqual({
      fps: 60,
    });
  });

  test("filters malformed segment entries but keeps well-formed ones", () => {
    expect(
      decodeEditState(
        encode({
          seg: [[0, 10], [5], ["a", "b"], null, [1, 2, 3], "nope", [20, 30]],
        }),
      ),
    ).toEqual({
      seg: [
        [0, 10],
        [20, 30],
      ],
    });
  });

  test("drops the seg key entirely when no entry is well-formed", () => {
    expect(decodeEditState(encode({ seg: [["a", "b"], null] }))).toBeNull();
  });

  test("accepts the four-number form that carries fades", () => {
    expect(decodeEditState(encode({ seg: [[0, 10, 1.5, 2]] }))).toEqual({
      seg: [[0, 10, 1.5, 2]],
    });
  });

  test("still reads a link written before fades existed", () => {
    expect(decodeEditState(encode({ seg: [[0, 10]] }))).toEqual({
      seg: [[0, 10]],
    });
  });

  test("drops a fade tuple with a non-number in it", () => {
    expect(decodeEditState(encode({ seg: [[0, 10, "1.5", 2]] }))).toBeNull();
  });

  test("does not reject negative or out-of-range segment numbers", () => {
    // Range clamping is buildEditStateUpdates' job, since the video duration
    // is not known at decode time. Decode only checks the shape.
    expect(decodeEditState(encode({ seg: [[-5, 99999]] }))).toEqual({
      seg: [[-5, 99999]],
    });
  });

  test("accepts an unknown format string, since the type is not validated", () => {
    // Documents a real gap: fmt is cast, not checked against the union.
    expect(decodeEditState(encode({ fmt: "avi" }))?.fmt).toBe("avi");
  });
});
