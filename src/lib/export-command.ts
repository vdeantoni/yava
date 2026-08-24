import type { CropRectangle } from "@/components/player/VideoCanvas";
import type { Format, Preset } from "@/store";

/**
 * Pure builders for the FFmpeg argument lists used by the export pipeline.
 *
 * These live outside the dialog so the filter maths can be asserted directly.
 * Nothing here touches the WASM filesystem or the store.
 */

/** libvpx has no -preset, so the x264 preset names map onto its own knobs. */
const WEBM_PRESET_MAP: Record<Preset, string[]> = {
  ultrafast: ["-deadline", "realtime", "-cpu-used", "8"],
  fast: ["-deadline", "realtime", "-cpu-used", "5"],
  medium: ["-deadline", "good", "-cpu-used", "4"],
  slow: ["-deadline", "good", "-cpu-used", "2"],
};

/** A single atempo filter only covers 0.5x to 2.0x, so larger shifts chain. */
const ATEMPO_MAX = 2;
const ATEMPO_MIN = 0.5;

export interface ExportSettings {
  format: Format;
  preset: Preset;
  frameRate: number;
  speed: number;
  /** Empty string means "keep aspect", which becomes -2. */
  outputWidth: string;
  outputHeight: string;
  noAudio: boolean;
  multithreading: boolean;
  cropRectangle: CropRectangle;
  /** Intrinsic dimensions of the source, not the displayed size. */
  videoWidth: number;
  videoHeight: number;
}

/** x264 rejects odd dimensions, so round down rather than up. */
const toEven = (n: number) => n - (n % 2);

/**
 * Filter order is deliberate. The leading scale normalizes a non-square SAR to
 * intrinsic pixels before crop coordinates are applied, otherwise the crop
 * lands in the wrong place on anamorphic sources.
 */
export function buildVideoFilters(settings: ExportSettings): string[] {
  const {
    cropRectangle: crop,
    videoWidth,
    videoHeight,
    outputWidth,
    outputHeight,
    speed,
  } = settings;

  const filters: string[] = [];

  if (crop.w && crop.h) {
    const cropW = toEven(Math.round((crop.w / crop.vw) * videoWidth));
    const cropH = toEven(Math.round((crop.h / crop.vh) * videoHeight));
    const cropX = Math.round((crop.x / crop.vw) * videoWidth);
    const cropY = Math.round((crop.y / crop.vh) * videoHeight);

    filters.push(`scale=${videoWidth}:${videoHeight}`);
    filters.push(`crop=${cropW}:${cropH}:${cropX}:${cropY}`);
  }

  const scaleW = Number(outputWidth) || -2;
  const scaleH = Number(outputHeight) || -2;
  filters.push(
    `scale=${scaleW > 0 ? toEven(scaleW) : scaleW}:${
      scaleH > 0 ? toEven(scaleH) : scaleH
    }`,
  );

  if (speed !== 1) {
    filters.push(`setpts=${(1 / speed).toFixed(4)}*PTS`);
  }

  return filters;
}

/** Empty when the speed is unchanged or the audio is being dropped. */
export function buildAudioFilters(settings: ExportSettings): string[] {
  const { speed, noAudio } = settings;
  if (speed === 1 || noAudio) return [];

  const filters: string[] = [];
  let remaining = speed;

  while (remaining > ATEMPO_MAX) {
    filters.push(`atempo=${ATEMPO_MAX.toFixed(1)}`);
    remaining /= ATEMPO_MAX;
  }
  while (remaining < ATEMPO_MIN) {
    filters.push(`atempo=${ATEMPO_MIN.toFixed(1)}`);
    remaining /= ATEMPO_MIN;
  }
  filters.push(`atempo=${remaining.toFixed(4)}`);

  return filters;
}

export function buildPresetArgs({ format, preset }: ExportSettings): string[] {
  if (format === "mp4" || format === "mov") return ["-preset", preset];
  if (format === "webm") return WEBM_PRESET_MAP[preset];
  return [];
}

/** Audio is stream-copied only when nothing needs to re-encode it. */
export function buildCodecArgs(
  settings: ExportSettings,
  audioFilters: string[],
): string[] {
  const { format, noAudio } = settings;
  const keepAudioAsIs = !noAudio && audioFilters.length === 0;

  if (format === "webm") {
    const args = ["-c:v", "libvpx", "-crf", "10", "-b:v", "1M"];
    if (keepAudioAsIs) args.push("-c:a", "libvorbis");
    return args;
  }

  if (keepAudioAsIs && format !== "gif") return ["-c:a", "copy"];

  return [];
}

/** libvpx scales poorly past two threads; the others cap at four. */
export function threadCount({
  multithreading,
  format,
}: ExportSettings): string {
  if (!multithreading) return "1";
  return format === "webm" ? "2" : "4";
}

export interface SegmentRange {
  input: string;
  start: number;
  duration: number;
  output: string;
}

/** Args for extracting and encoding one contiguous range of the source. */
export function buildSegmentArgs(
  settings: ExportSettings,
  { input, start, duration, output }: SegmentRange,
): string[] {
  const { frameRate, noAudio } = settings;
  const videoFilters = buildVideoFilters(settings);
  const audioFilters = buildAudioFilters(settings);

  return [
    "-ss",
    String(start),
    "-i",
    input,
    "-t",
    String(duration),
    "-threads",
    threadCount(settings),
    frameRate && "-r",
    frameRate && String(frameRate),
    "-vf",
    videoFilters.join(","),

    audioFilters.length && "-af",
    audioFilters.length && audioFilters.join(","),

    noAudio && "-an",

    ...buildCodecArgs(settings, audioFilters),
    ...buildPresetArgs(settings),

    output,
  ].filter(Boolean) as string[];
}

/** Body of the concat demuxer list file. */
export function buildConcatList(segmentFiles: string[]): string {
  return segmentFiles.map((f) => `file '${f}'`).join("\n");
}

/** Args for stitching already-encoded segments without re-encoding. */
export function buildConcatArgs(listFile: string, output: string): string[] {
  return ["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", output];
}
