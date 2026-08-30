import { cropToSource, hasArea, type CropRectangle } from "@/lib/crop";
import { fadeFilters, type FadeRange } from "@/lib/fade";
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
  /** Empty string means "work it out from the source and the crop". */
  outputWidth: string;
  outputHeight: string;
  noAudio: boolean;
  multithreading: boolean;
  cropRectangle: CropRectangle;
  /** Intrinsic dimensions of the source, not the displayed size. */
  videoWidth: number;
  videoHeight: number;
}

const NO_FADES: FadeRange = { duration: 0 };

/** x264 rejects odd dimensions, so round down rather than up. */
const toEven = (n: number) => n - (n % 2);

export type OutputSizeInputs = Pick<
  ExportSettings,
  | "cropRectangle"
  | "videoWidth"
  | "videoHeight"
  | "outputWidth"
  | "outputHeight"
>;

/**
 * The size an export will actually be.
 *
 * One function answers this for both the panel's inputs and the encoder, so the
 * number on screen is the number that comes out. Setting one axis and leaving
 * the other blank keeps the aspect ratio, which is why the blank axis resolves
 * to a real value here instead of being left for ffmpeg's `-2`.
 */
export function effectiveOutputSize({
  cropRectangle: crop,
  videoWidth,
  videoHeight,
  outputWidth,
  outputHeight,
}: OutputSizeInputs): { width: number; height: number } {
  const cropped = hasArea(crop) && crop.vw > 0 && crop.vh > 0;
  const inSource = cropToSource(crop, videoWidth, videoHeight);
  const source = cropped
    ? { width: inSource.w, height: inSource.h }
    : { width: videoWidth, height: videoHeight };

  // A source with no measured dimensions would otherwise put NaN in the inputs.
  const even = (n: number) =>
    Number.isFinite(n) ? Math.max(2, toEven(Math.round(n))) : 2;
  const aspect = source.height > 0 ? source.width / source.height : 1;

  const w = Number(outputWidth) || 0;
  const h = Number(outputHeight) || 0;

  if (w && h) return { width: even(w), height: even(h) };
  if (w) return { width: even(w), height: even(w / aspect) };
  if (h) return { width: even(h * aspect), height: even(h) };
  return { width: even(source.width), height: even(source.height) };
}

/**
 * Filter order is deliberate. The leading scale normalizes a non-square SAR to
 * intrinsic pixels before crop coordinates are applied, otherwise the crop
 * lands in the wrong place on anamorphic sources. Fades come before `setpts`,
 * so their lengths stay in source seconds and cover the same frames whatever
 * the speed is set to.
 */
export function buildVideoFilters(
  settings: ExportSettings,
  range: FadeRange = NO_FADES,
): string[] {
  const { cropRectangle: crop, videoWidth, videoHeight, speed } = settings;

  const filters: string[] = [];

  if (hasArea(crop)) {
    const inSource = cropToSource(crop, videoWidth, videoHeight);

    filters.push(`scale=${videoWidth}:${videoHeight}`);
    filters.push(
      `crop=${toEven(Math.round(inSource.w))}:${toEven(Math.round(inSource.h))}:${Math.round(inSource.x)}:${Math.round(inSource.y)}`,
    );
  }

  // The panel shows this same size, so what is on screen is what comes out.
  const { width, height } = effectiveOutputSize(settings);
  filters.push(`scale=${width}:${height}`);

  filters.push(...fadeFilters(range));

  if (speed !== 1) {
    filters.push(`setpts=${(1 / speed).toFixed(4)}*PTS`);
  }

  return filters;
}

/** Empty when the audio is dropped, or when nothing about it changes. */
export function buildAudioFilters(
  settings: ExportSettings,
  range: FadeRange = NO_FADES,
): string[] {
  const { speed, noAudio } = settings;
  if (noAudio) return [];

  const filters = fadeFilters(range, "afade");
  if (speed === 1) return filters;

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

  // A gif carries its own palette and has no audio track, so neither the pixel
  // format nor the stream copy below applies to it.
  if (format === "gif") return [];

  const keepAudioAsIs = !noAudio && audioFilters.length === 0;

  // Without this the encoder inherits the source's pixel format, and a 10-bit
  // source yields H.264 High 10, which no browser decodes.
  const args = ["-pix_fmt", "yuv420p"];

  if (format === "webm") {
    args.push("-c:v", "libvpx", "-crf", "10", "-b:v", "1M");
    if (keepAudioAsIs) args.push("-c:a", "libvorbis");
    return args;
  }

  if (keepAudioAsIs) args.push("-c:a", "copy");

  return args;
}

/** libvpx scales poorly past two threads; the others cap at four. */
export function threadCount({
  multithreading,
  format,
}: ExportSettings): string {
  if (!multithreading) return "1";
  return format === "webm" ? "2" : "4";
}

export interface SegmentRange extends FadeRange {
  input: string;
  start: number;
  output: string;
}

/** Args for extracting and encoding one contiguous range of the source. */
export function buildSegmentArgs(
  settings: ExportSettings,
  range: SegmentRange,
): string[] {
  const { input, start, duration, output } = range;
  const { frameRate, noAudio } = settings;
  const videoFilters = buildVideoFilters(settings, range);
  const audioFilters = buildAudioFilters(settings, range);

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
