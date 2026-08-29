import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { SegmentLike } from "@/lib/utils";
import {
  buildConcatArgs,
  buildConcatList,
  buildSegmentArgs,
  type ExportSettings,
} from "@/lib/export-command";

export const INPUT_FILE = "video_file";
export const CONCAT_LIST = "concat_list.txt";

/** The slice of the FFmpeg API an export needs, so a fake can stand in for it. */
export type ExportFFmpeg = Pick<
  FFmpeg,
  "writeFile" | "exec" | "readFile" | "deleteFile"
>;

export interface ExportRunOptions {
  ffmpeg: ExportFFmpeg;
  /** Source bytes, already read out of the Blob. */
  input: Uint8Array;
  settings: ExportSettings;
  segments: SegmentLike[];
}

/**
 * `exec` resolves with an exit code rather than rejecting: 0 is success, and
 * anything else is a timeout or an encoding error.
 */
async function exec(ffmpeg: ExportFFmpeg, args: string[], step: string) {
  const code = await ffmpeg.exec(args);
  if (code !== 0) {
    throw new Error(`FFmpeg exited with code ${code} while ${step}.`);
  }
}

/** Encode the kept segments and return the finished file. */
export async function runExport({
  ffmpeg,
  input,
  settings,
  segments,
}: ExportRunOptions): Promise<Uint8Array<ArrayBuffer>> {
  if (segments.length === 0) {
    throw new Error("There is nothing to export.");
  }

  const output = `output.${settings.format}`;
  const segmentFiles = segments.map(
    (_, i) => `segment_${i}.${settings.format}`,
  );

  const scratch = [INPUT_FILE, output];
  if (segments.length > 1) scratch.push(CONCAT_LIST, ...segmentFiles);

  try {
    await ffmpeg.writeFile(INPUT_FILE, input);

    const encode = (segment: SegmentLike, to: string, step: string) =>
      exec(
        ffmpeg,
        buildSegmentArgs(settings, {
          input: INPUT_FILE,
          start: segment.sourceStart,
          duration: segment.sourceEnd - segment.sourceStart,
          output: to,
        }),
        step,
      );

    if (segments.length === 1) {
      await encode(segments[0], output, "encoding the video");
    } else {
      for (const [i, segment] of segments.entries()) {
        await encode(
          segment,
          segmentFiles[i],
          `encoding segment ${i + 1} of ${segments.length}`,
        );
      }

      await ffmpeg.writeFile(
        CONCAT_LIST,
        new TextEncoder().encode(buildConcatList(segmentFiles)),
      );
      await exec(
        ffmpeg,
        buildConcatArgs(CONCAT_LIST, output),
        "joining the segments",
      );
    }

    // readFile only hands back a string when asked for a text encoding.
    return (await ffmpeg.readFile(output)) as Uint8Array<ArrayBuffer>;
  } finally {
    for (const path of scratch) {
      // The run may have died before creating this one, and a terminated
      // FFmpeg rejects every call. Neither should mask the real failure.
      await ffmpeg.deleteFile(path).catch(() => {});
    }
  }
}
