import { describe, it, expect } from "vitest";
import {
  runExport,
  INPUT_FILE,
  CONCAT_LIST,
  type ExportFFmpeg,
} from "./export-run";
import type { ExportSettings } from "./export-command";

const SETTINGS: ExportSettings = {
  format: "mp4",
  preset: "ultrafast",
  frameRate: 30,
  speed: 1,
  outputWidth: "",
  outputHeight: "",
  noAudio: false,
  multithreading: false,
  cropRectangle: { x: 0, y: 0, w: 0, h: 0, vw: 0, vh: 0 },
  videoWidth: 1920,
  videoHeight: 1080,
};

const OUTPUT = "output.mp4";

interface FakeOptions {
  /** Return this exit code for the nth exec (0-based); others succeed. */
  failExecAt?: number;
  exitCode?: number;
  /** Write a partial output file even though the exec fails. */
  leavePartialFile?: boolean;
  readFileError?: Error;
  deleteFileError?: Error;
}

/** Records the call order and models the WASM filesystem as a Map. */
function fakeFFmpeg(options: FakeOptions = {}) {
  const encode = (text: string) => new TextEncoder().encode(text);
  const files = new Map<string, Uint8Array | string>();
  const calls: string[] = [];
  const execArgs: string[][] = [];
  let execCount = 0;

  const ffmpeg: ExportFFmpeg = {
    async writeFile(path, data) {
      calls.push(`write ${path}`);
      files.set(path, data);
      return true;
    },
    async exec(args) {
      const output = args[args.length - 1];
      calls.push(`exec ${output}`);
      execArgs.push(args);

      const failing = execCount++ === options.failExecAt;
      if (failing) {
        if (options.leavePartialFile) files.set(output, encode("partial"));
        return options.exitCode ?? 1;
      }

      files.set(output, encode(`encoded ${output}`));
      return 0;
    },
    async readFile(path) {
      calls.push(`read ${path}`);
      if (options.readFileError) throw options.readFileError;
      const data = files.get(path);
      if (data === undefined) throw new Error(`${path}: no such file`);
      return data;
    },
    async deleteFile(path) {
      calls.push(`delete ${path}`);
      if (options.deleteFileError) throw options.deleteFileError;
      if (!files.has(path)) throw new Error(`${path}: no such file`);
      files.delete(path);
      return true;
    },
  };

  return { ffmpeg, files, calls, execArgs };
}

const oneSegment = [{ sourceStart: 2, sourceEnd: 8 }];
const threeSegments = [
  { sourceStart: 0, sourceEnd: 5 },
  { sourceStart: 10, sourceEnd: 12 },
  { sourceStart: 20, sourceEnd: 30 },
];

const run = (ffmpeg: ExportFFmpeg, segments = oneSegment) =>
  runExport({
    ffmpeg,
    input: new Uint8Array([1, 2, 3]),
    settings: SETTINGS,
    segments,
  });

describe("runExport", () => {
  it("encodes a single segment in one pass", async () => {
    const { ffmpeg, calls, execArgs } = fakeFFmpeg();

    await run(ffmpeg);

    expect(calls).toEqual([
      `write ${INPUT_FILE}`,
      `exec ${OUTPUT}`,
      `read ${OUTPUT}`,
      `delete ${INPUT_FILE}`,
      `delete ${OUTPUT}`,
    ]);
    expect(execArgs).toHaveLength(1);
    expect(execArgs[0]).toContain("-ss");
    expect(execArgs[0][execArgs[0].indexOf("-ss") + 1]).toBe("2");
    expect(execArgs[0][execArgs[0].indexOf("-t") + 1]).toBe("6");
  });

  it("returns the encoded bytes to the caller", async () => {
    const { ffmpeg } = fakeFFmpeg();

    const data = await run(ffmpeg);

    expect(new TextDecoder().decode(data)).toBe(`encoded ${OUTPUT}`);
  });

  it("encodes each segment then concatenates them", async () => {
    const { ffmpeg, calls, files } = fakeFFmpeg();

    await run(ffmpeg, threeSegments);

    expect(calls).toEqual([
      `write ${INPUT_FILE}`,
      "exec segment_0.mp4",
      "exec segment_1.mp4",
      "exec segment_2.mp4",
      `write ${CONCAT_LIST}`,
      `exec ${OUTPUT}`,
      `read ${OUTPUT}`,
      `delete ${INPUT_FILE}`,
      `delete ${OUTPUT}`,
      `delete ${CONCAT_LIST}`,
      "delete segment_0.mp4",
      "delete segment_1.mp4",
      "delete segment_2.mp4",
    ]);
    expect(files.size).toBe(0);
  });

  it("gives each segment its own range", async () => {
    const { ffmpeg, execArgs } = fakeFFmpeg();

    await run(ffmpeg, threeSegments);

    const ranges = execArgs
      .slice(0, 3)
      .map((args) => [
        args[args.indexOf("-ss") + 1],
        args[args.indexOf("-t") + 1],
      ]);
    expect(ranges).toEqual([
      ["0", "5"],
      ["10", "2"],
      ["20", "10"],
    ]);
  });

  it("lists the segments for the demuxer in order", async () => {
    const written: string[] = [];
    const { ffmpeg } = fakeFFmpeg();
    const writeFile = ffmpeg.writeFile.bind(ffmpeg);
    ffmpeg.writeFile = async (path, data) => {
      if (path === CONCAT_LIST) {
        written.push(
          typeof data === "string" ? data : new TextDecoder().decode(data),
        );
      }
      return writeFile(path, data);
    };

    await run(ffmpeg, threeSegments);

    expect(written).toEqual([
      "file 'segment_0.mp4'\nfile 'segment_1.mp4'\nfile 'segment_2.mp4'",
    ]);
  });

  it("fails with the step that broke when a segment does not encode", async () => {
    const { ffmpeg } = fakeFFmpeg({ failExecAt: 1 });

    await expect(run(ffmpeg, threeSegments)).rejects.toThrow(
      "FFmpeg exited with code 1 while encoding segment 2 of 3.",
    );
  });

  it("names the concat step when the join fails", async () => {
    const { ffmpeg } = fakeFFmpeg({ failExecAt: 3 });

    await expect(run(ffmpeg, threeSegments)).rejects.toThrow(
      "while joining the segments",
    );
  });

  it("reports the exit code it got", async () => {
    const { ffmpeg } = fakeFFmpeg({ failExecAt: 0, exitCode: 69 });

    await expect(run(ffmpeg)).rejects.toThrow("exited with code 69");
  });

  it("leaves nothing behind when a segment fails midway", async () => {
    const { ffmpeg, files } = fakeFFmpeg({
      failExecAt: 1,
      leavePartialFile: true,
    });

    await expect(run(ffmpeg, threeSegments)).rejects.toThrow();

    expect([...files.keys()]).toEqual([]);
  });

  it("leaves nothing behind when the result cannot be read", async () => {
    const { ffmpeg, files } = fakeFFmpeg({
      readFileError: new Error("FS error: no such file"),
    });

    await expect(run(ffmpeg)).rejects.toThrow("FS error");

    expect([...files.keys()]).toEqual([]);
  });

  it("keeps the original failure when cleanup cannot run either", async () => {
    // What a cancelled export looks like: terminate() rejects every later call.
    const { ffmpeg } = fakeFFmpeg({
      failExecAt: 0,
      deleteFileError: new Error("called FFmpeg.terminate()"),
    });

    await expect(run(ffmpeg)).rejects.toThrow("FFmpeg exited with code 1");
  });

  it("attempts every scratch path even when a delete fails", async () => {
    const { ffmpeg, calls } = fakeFFmpeg({
      failExecAt: 1,
      deleteFileError: new Error("called FFmpeg.terminate()"),
    });

    await expect(run(ffmpeg, threeSegments)).rejects.toThrow();

    expect(calls.filter((c) => c.startsWith("delete"))).toEqual([
      `delete ${INPUT_FILE}`,
      `delete ${OUTPUT}`,
      `delete ${CONCAT_LIST}`,
      "delete segment_0.mp4",
      "delete segment_1.mp4",
      "delete segment_2.mp4",
    ]);
  });

  it("refuses to run with no segments", async () => {
    const { ffmpeg, calls } = fakeFFmpeg();

    await expect(run(ffmpeg, [])).rejects.toThrow("nothing to export");

    expect(calls).toEqual([]);
  });
});
