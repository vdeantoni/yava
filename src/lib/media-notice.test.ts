import { describe, expect, test } from "vitest";
import {
  describeBlankPicture,
  describeMediaError,
  mediaErrorDetail,
  mediaStateDetail,
} from "./media-notice";

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

describe("mediaStateDetail", () => {
  test("names both enums", () => {
    expect(mediaStateDetail(0, 3)).toBe("ready nothing · network no-source");
    expect(mediaStateDetail(4, 1)).toBe("ready enough-data · network idle");
  });

  test("falls back to the number for a state it does not know", () => {
    expect(mediaStateDetail(9, 9)).toBe("ready 9 · network 9");
  });
});

describe("mediaErrorDetail", () => {
  test("names the code", () => {
    expect(mediaErrorDetail(1)).toBe("error aborted");
    expect(mediaErrorDetail(4)).toBe("error unsupported");
  });

  test("says so when the element raised an error with no code", () => {
    expect(mediaErrorDetail(undefined)).toBe("error no-code");
  });

  test("falls back to the number for a code it does not know", () => {
    expect(mediaErrorDetail(7)).toBe("error 7");
  });
});

describe("describeBlankPicture", () => {
  test("asks for a gesture when the element parked on the metadata", () => {
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

  test("does not mistake a still-reading element for a parked one", () => {
    expect(describeBlankPicture(1, 2).tone).toBe("error");
  });

  test("carries the state through either way", () => {
    expect(describeBlankPicture(1, 1).detail).toBe(
      "ready metadata · network idle",
    );
  });
});
