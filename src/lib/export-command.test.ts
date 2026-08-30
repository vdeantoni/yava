import { describe, test, expect } from "vitest";
import {
  buildAudioFilters,
  buildCodecArgs,
  buildConcatArgs,
  buildConcatList,
  buildPresetArgs,
  buildSegmentArgs,
  buildVideoFilters,
  threadCount,
  type ExportSettings,
  effectiveOutputSize,
  type OutputSizeInputs,
} from "./export-command";

const NO_CROP = { x: 0, y: 0, w: 0, h: 0, vw: 0, vh: 0 };

/** 1000x600 source, mp4, no crop, no scaling, 30fps, 1x, audio on, MT off. */
function settings(overrides: Partial<ExportSettings> = {}): ExportSettings {
  return {
    format: "mp4",
    preset: "ultrafast",
    frameRate: 30,
    speed: 1,
    outputWidth: "",
    outputHeight: "",
    noAudio: false,
    multithreading: false,
    cropRectangle: NO_CROP,
    videoWidth: 1000,
    videoHeight: 600,
    ...overrides,
  };
}

describe("buildVideoFilters", () => {
  test("scales to the source size when neither axis is pinned", () => {
    expect(buildVideoFilters(settings())).toEqual(["scale=1000:600"]);
  });

  test("uses explicit output dimensions when given", () => {
    const filters = buildVideoFilters(
      settings({ outputWidth: "1280", outputHeight: "720" }),
    );
    expect(filters).toEqual(["scale=1280:720"]);
  });

  test("rounds odd output dimensions down to even for x264", () => {
    const filters = buildVideoFilters(
      settings({ outputWidth: "1921", outputHeight: "1081" }),
    );
    expect(filters).toEqual(["scale=1920:1080"]);
  });

  test("resolves the axis left blank from the aspect ratio", () => {
    // 1000x600 is 5:3, and the encoder gets a real number rather than -2, so
    // the panel can show the same one.
    expect(buildVideoFilters(settings({ outputWidth: "640" }))).toEqual([
      "scale=640:384",
    ]);
    expect(buildVideoFilters(settings({ outputHeight: "480" }))).toEqual([
      "scale=800:480",
    ]);
  });

  test("scales to intrinsic size before cropping, so a non-square SAR lands right", () => {
    // Crop rect measured against a 100x60 display box, source is 1000x600.
    const filters = buildVideoFilters(
      settings({
        cropRectangle: { x: 10, y: 20, w: 50, h: 30, vw: 100, vh: 60 },
      }),
    );

    expect(filters).toEqual([
      "scale=1000:600",
      "crop=500:300:100:200",
      "scale=500:300",
    ]);
  });

  test("converts the crop rect against intrinsic dimensions, not the display box", () => {
    // Same fractional rect, but the display box is half the size. The crop
    // must come out identical because it is resolved against the source.
    const half = buildVideoFilters(
      settings({
        cropRectangle: { x: 5, y: 10, w: 25, h: 15, vw: 50, vh: 30 },
      }),
    );
    const full = buildVideoFilters(
      settings({
        cropRectangle: { x: 10, y: 20, w: 50, h: 30, vw: 100, vh: 60 },
      }),
    );
    expect(half).toEqual(full);
  });

  test("rounds crop width and height down to even", () => {
    const filters = buildVideoFilters(
      settings({
        cropRectangle: { x: 0, y: 0, w: 50.1, h: 30.1, vw: 100, vh: 60 },
      }),
    );
    expect(filters[1]).toBe("crop=500:300:0:0");
  });

  test("ignores a crop rect with no area", () => {
    const filters = buildVideoFilters(
      settings({
        cropRectangle: { x: 10, y: 10, w: 0, h: 0, vw: 100, vh: 60 },
      }),
    );
    expect(filters).toEqual(["scale=1000:600"]);
  });

  test("appends setpts for a speed change, after the scale", () => {
    expect(buildVideoFilters(settings({ speed: 2 }))).toEqual([
      "scale=1000:600",
      "setpts=0.5000*PTS",
    ]);
    expect(buildVideoFilters(settings({ speed: 0.5 }))).toEqual([
      "scale=1000:600",
      "setpts=2.0000*PTS",
    ]);
  });

  test("omits setpts at 1x", () => {
    expect(buildVideoFilters(settings({ speed: 1 })).join(",")).not.toContain(
      "setpts",
    );
  });

  test("orders crop normalization, crop, output scale, then setpts", () => {
    const filters = buildVideoFilters(
      settings({
        cropRectangle: { x: 0, y: 0, w: 50, h: 30, vw: 100, vh: 60 },
        outputWidth: "640",
        speed: 2,
      }),
    );
    expect(filters).toEqual([
      "scale=1000:600",
      "crop=500:300:0:0",
      "scale=640:384",
      "setpts=0.5000*PTS",
    ]);
  });
});

describe("buildAudioFilters", () => {
  test("is empty at 1x", () => {
    expect(buildAudioFilters(settings({ speed: 1 }))).toEqual([]);
  });

  test("is empty when the audio is dropped", () => {
    expect(buildAudioFilters(settings({ speed: 2, noAudio: true }))).toEqual(
      [],
    );
  });

  test("uses a single atempo inside the 0.5x-2x range", () => {
    expect(buildAudioFilters(settings({ speed: 1.5 }))).toEqual([
      "atempo=1.5000",
    ]);
    expect(buildAudioFilters(settings({ speed: 2 }))).toEqual([
      "atempo=2.0000",
    ]);
  });

  test("chains atempo above 2x, since one filter cannot span it", () => {
    expect(buildAudioFilters(settings({ speed: 4 }))).toEqual([
      "atempo=2.0",
      "atempo=2.0000",
    ]);
    expect(buildAudioFilters(settings({ speed: 3 }))).toEqual([
      "atempo=2.0",
      "atempo=1.5000",
    ]);
  });

  test("chains atempo below 0.5x", () => {
    expect(buildAudioFilters(settings({ speed: 0.25 }))).toEqual([
      "atempo=0.5",
      "atempo=0.5000",
    ]);
  });

  test("chain multiplies back to the requested speed", () => {
    for (const speed of [0.25, 0.4, 0.5, 1.5, 2, 3, 4, 8]) {
      const product = buildAudioFilters(settings({ speed }))
        .map((f) => Number(f.replace("atempo=", "")))
        .reduce((a, b) => a * b, 1);
      expect(product).toBeCloseTo(speed, 3);
    }
  });
});

describe("buildPresetArgs", () => {
  test("passes the preset straight through for x264 formats", () => {
    expect(
      buildPresetArgs(settings({ format: "mp4", preset: "slow" })),
    ).toEqual(["-preset", "slow"]);
    expect(
      buildPresetArgs(settings({ format: "mov", preset: "fast" })),
    ).toEqual(["-preset", "fast"]);
  });

  test("maps preset names onto libvpx knobs for webm", () => {
    expect(
      buildPresetArgs(settings({ format: "webm", preset: "ultrafast" })),
    ).toEqual(["-deadline", "realtime", "-cpu-used", "8"]);
    expect(
      buildPresetArgs(settings({ format: "webm", preset: "slow" })),
    ).toEqual(["-deadline", "good", "-cpu-used", "2"]);
  });

  test("has no preset concept for gif", () => {
    expect(buildPresetArgs(settings({ format: "gif" }))).toEqual([]);
  });
});

describe("buildCodecArgs", () => {
  test("stream-copies audio when nothing needs to re-encode it", () => {
    expect(buildCodecArgs(settings(), [])).toEqual([
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "copy",
    ]);
  });

  test("drops the copy when an audio filter is active", () => {
    expect(buildCodecArgs(settings({ speed: 2 }), ["atempo=2.0000"])).toEqual([
      "-pix_fmt",
      "yuv420p",
    ]);
  });

  test("drops the copy when the audio is removed", () => {
    expect(buildCodecArgs(settings({ noAudio: true }), [])).toEqual([
      "-pix_fmt",
      "yuv420p",
    ]);
  });

  test("never stream-copies audio into a gif", () => {
    expect(buildCodecArgs(settings({ format: "gif" }), [])).toEqual([]);
  });

  test("pins 8-bit 4:2:0, since no browser decodes H.264 High 10", () => {
    for (const format of ["mp4", "mov", "webm"] as const) {
      expect(buildCodecArgs(settings({ format }), [])).toEqual(
        expect.arrayContaining(["-pix_fmt", "yuv420p"]),
      );
    }
  });

  test("leaves a gif to its own palette", () => {
    expect(buildCodecArgs(settings({ format: "gif" }), [])).not.toContain(
      "-pix_fmt",
    );
  });

  test("selects libvpx for webm, with vorbis when audio passes through", () => {
    expect(buildCodecArgs(settings({ format: "webm" }), [])).toEqual([
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libvpx",
      "-crf",
      "10",
      "-b:v",
      "1M",
      "-c:a",
      "libvorbis",
    ]);
  });

  test("keeps libvpx but drops vorbis when an audio filter is active", () => {
    expect(
      buildCodecArgs(settings({ format: "webm", speed: 2 }), ["atempo=2.0000"]),
    ).toEqual([
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libvpx",
      "-crf",
      "10",
      "-b:v",
      "1M",
    ]);
  });
});

describe("threadCount", () => {
  test("is single-threaded without cross-origin isolation", () => {
    expect(threadCount(settings({ multithreading: false }))).toBe("1");
    expect(
      threadCount(settings({ multithreading: false, format: "webm" })),
    ).toBe("1");
  });

  test("caps libvpx lower than x264", () => {
    expect(
      threadCount(settings({ multithreading: true, format: "webm" })),
    ).toBe("2");
    expect(threadCount(settings({ multithreading: true, format: "mp4" }))).toBe(
      "4",
    );
    expect(threadCount(settings({ multithreading: true, format: "gif" }))).toBe(
      "4",
    );
  });
});

describe("buildSegmentArgs", () => {
  const range = {
    input: "video_file",
    start: 1.5,
    duration: 8.25,
    output: "out.mp4",
  };

  test("seeks and trims around the requested range", () => {
    const args = buildSegmentArgs(settings(), range);
    expect(args.slice(0, 6)).toEqual([
      "-ss",
      "1.5",
      "-i",
      "video_file",
      "-t",
      "8.25",
    ]);
  });

  test("puts the output path last", () => {
    expect(buildSegmentArgs(settings(), range).at(-1)).toBe("out.mp4");
  });

  test("includes the frame rate when set", () => {
    const args = buildSegmentArgs(settings({ frameRate: 24 }), range);
    expect(args).toContain("-r");
    expect(args[args.indexOf("-r") + 1]).toBe("24");
  });

  test("omits the frame rate flag entirely when it is zero", () => {
    const args = buildSegmentArgs(settings({ frameRate: 0 }), range);
    expect(args).not.toContain("-r");
  });

  test("always passes a non-empty -vf value", () => {
    // The arg list is filtered for falsy entries, so an empty filter string
    // would leave a dangling -vf and shift every later argument.
    const args = buildSegmentArgs(settings(), range);
    const vf = args[args.indexOf("-vf") + 1];
    expect(vf).toBeTruthy();
    expect(vf).not.toBe("-threads");
  });

  test("adds -af only when an audio filter exists", () => {
    expect(buildSegmentArgs(settings(), range)).not.toContain("-af");

    const sped = buildSegmentArgs(settings({ speed: 2 }), range);
    expect(sped[sped.indexOf("-af") + 1]).toBe("atempo=2.0000");
  });

  test("adds -an when the audio is dropped, and no -af with it", () => {
    const args = buildSegmentArgs(settings({ noAudio: true, speed: 2 }), range);
    expect(args).toContain("-an");
    expect(args).not.toContain("-af");
  });

  test("passes the thread cap through", () => {
    const args = buildSegmentArgs(settings({ multithreading: true }), range);
    expect(args[args.indexOf("-threads") + 1]).toBe("4");
  });

  test("joins multiple video filters with commas", () => {
    const args = buildSegmentArgs(
      settings({
        cropRectangle: { x: 0, y: 0, w: 50, h: 30, vw: 100, vh: 60 },
        speed: 2,
      }),
      range,
    );
    expect(args[args.indexOf("-vf") + 1]).toBe(
      "scale=1000:600,crop=500:300:0:0,scale=500:300,setpts=0.5000*PTS",
    );
  });
});

describe("concat", () => {
  test("quotes each file on its own line for the demuxer", () => {
    expect(buildConcatList(["segment_0.mp4", "segment_1.mp4"])).toBe(
      "file 'segment_0.mp4'\nfile 'segment_1.mp4'",
    );
  });

  test("handles a single segment without a trailing newline", () => {
    expect(buildConcatList(["segment_0.mp4"])).toBe("file 'segment_0.mp4'");
  });

  test("stitches without re-encoding", () => {
    expect(buildConcatArgs("concat_list.txt", "out.mp4")).toEqual([
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      "concat_list.txt",
      "-c",
      "copy",
      "out.mp4",
    ]);
  });
});

describe("effectiveOutputSize", () => {
  const inputs = (over: Partial<OutputSizeInputs> = {}): OutputSizeInputs => ({
    cropRectangle: { x: 0, y: 0, w: 0, h: 0, vw: 0, vh: 0 },
    videoWidth: 1920,
    videoHeight: 1080,
    outputWidth: "",
    outputHeight: "",
    ...over,
  });

  test("falls back to the source size", () => {
    expect(effectiveOutputSize(inputs())).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  test("rounds an odd source down to even, as the encoder will", () => {
    expect(
      effectiveOutputSize(inputs({ videoWidth: 1081, videoHeight: 607 })),
    ).toEqual({ width: 1080, height: 606 });
  });

  test("uses the crop rect, scaled against intrinsic dimensions", () => {
    // Half the width, a third of the height, of a 400x300 display box.
    const cropRectangle = { x: 0, y: 0, w: 200, h: 100, vw: 400, vh: 300 };
    expect(effectiveOutputSize(inputs({ cropRectangle }))).toEqual({
      width: 960,
      height: 360,
    });
  });

  test("ignores a crop rect with no area", () => {
    const cropRectangle = { x: 10, y: 10, w: 0, h: 0, vw: 400, vh: 300 };
    expect(effectiveOutputSize(inputs({ cropRectangle }))).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  test("takes both overrides as given", () => {
    expect(
      effectiveOutputSize(inputs({ outputWidth: "640", outputHeight: "480" })),
    ).toEqual({ width: 640, height: 480 });
  });

  test("keeps the aspect ratio when only the width is set", () => {
    expect(effectiveOutputSize(inputs({ outputWidth: "1280" }))).toEqual({
      width: 1280,
      height: 720,
    });
  });

  test("keeps the aspect ratio when only the height is set", () => {
    expect(effectiveOutputSize(inputs({ outputHeight: "540" }))).toEqual({
      width: 960,
      height: 540,
    });
  });

  test("derives the aspect from the crop, not the source", () => {
    // A square crop out of a 16:9 source: one axis given, the other follows.
    const cropRectangle = { x: 0, y: 0, w: 100, h: 100, vw: 400, vh: 400 };
    expect(
      effectiveOutputSize(
        inputs({ cropRectangle, videoHeight: 1920, outputWidth: "500" }),
      ),
    ).toEqual({ width: 500, height: 500 });
  });

  test("rounds an override down to even", () => {
    expect(effectiveOutputSize(inputs({ outputWidth: "641" }))).toEqual({
      width: 640,
      height: 360,
    });
  });

  test("never returns zero, which no encoder accepts", () => {
    expect(effectiveOutputSize(inputs({ outputWidth: "1" }))).toEqual({
      width: 2,
      height: 2,
    });
    expect(
      effectiveOutputSize(inputs({ videoWidth: 0, videoHeight: 0 })),
    ).toEqual({ width: 2, height: 2 });
  });
});
