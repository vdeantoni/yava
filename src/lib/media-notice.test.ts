import { describe, expect, test } from "vitest";
import {
  describeBlankPicture,
  describeMediaError,
  describeMissingMetadata,
} from "./media-notice";

describe("describeMediaError", () => {
  test("blames the network for a network error", () => {
    expect(describeMediaError(2).message).toMatch(/connection/i);
  });

  test("points at the pixel format for a decode failure", () => {
    for (const code of [3, 4]) {
      expect(describeMediaError(code).message).toMatch(/cannot decode/i);
      expect(describeMediaError(code).message).toMatch(/10-bit/);
    }
  });

  test("assumes an unsupported codec when the element reports no code", () => {
    // Chromium fires error with a null MediaError for a codec it cannot use.
    expect(describeMediaError(undefined).message).toMatch(/cannot decode/i);
  });

  test("says so when loading was interrupted", () => {
    expect(describeMediaError(1).message).toMatch(/interrupted/i);
  });

  test("names the code underneath, and says so when there is none", () => {
    expect(describeMediaError(1).detail).toBe("error aborted");
    expect(describeMediaError(4).detail).toBe("error unsupported");
    expect(describeMediaError(undefined).detail).toBe("error no-code");
    expect(describeMediaError(7).detail).toBe("error 7");
  });

  test("is always the browser's fault", () => {
    expect(describeMediaError(3).tone).toBe("error");
  });
});

describe("describeMissingMetadata", () => {
  test("carries the state the element stopped in", () => {
    const notice = describeMissingMetadata(0, 2);
    expect(notice.detail).toBe("ready nothing · network loading");
    expect(notice.tone).toBe("error");
  });
});

describe("describeBlankPicture", () => {
  test("asks for a gesture when the element stopped on the metadata", () => {
    // iOS Safari reads the header, stops, and waits to be asked for playback.
    const notice = describeBlankPicture(1, 1);
    expect(notice.message).toMatch(/press play/i);
    expect(notice.tone).toBe("hint");
  });

  test("blames the decoder when the element read everything and drew nothing", () => {
    const notice = describeBlankPicture(4, 1);
    expect(notice.message).toMatch(/decoded no frames/i);
    expect(notice.tone).toBe("error");
  });

  test("does not mistake a still-reading element for a stopped one", () => {
    expect(describeBlankPicture(1, 2).tone).toBe("error");
  });

  test("names both enums, and falls back to the number for either", () => {
    expect(describeBlankPicture(1, 1).detail).toBe(
      "ready metadata · network idle",
    );
    expect(describeBlankPicture(4, 3).detail).toBe(
      "ready enough-data · network no-source",
    );
    expect(describeBlankPicture(9, 9).detail).toBe("ready 9 · network 9");
  });
});
