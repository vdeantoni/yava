import {
  useAppStore,
  DEFAULT_EXPORT,
  type Format,
  type Preset,
} from "@/store.tsx";
import { useShallow } from "zustand/react/shallow";
import { effectiveOutputSize } from "@/lib/export-command.ts";
import { useEffect, useId } from "react";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { secondsToDuration } from "@/lib/utils.ts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import VideoExportDialog from "@/components/export/VideoExportDialog.tsx";
import { supportsMultithreading } from "@/hooks/useFFmpeg.ts";
import { FileOutput } from "lucide-react";

const ExportPanel = () => {
  const id = useId();
  const {
    video,
    cropRectangle,
    segments,
    format,
    setFormat,
    preset,
    setPreset,
    frameRate,
    setFrameRate,
    speed,
    setSpeed,
    outputWidth,
    setOutputWidth,
    outputHeight,
    setOutputHeight,
    noAudio,
    setNoAudio,
    multithreading,
    setMultithreading,
    resetExportOptions,
  } = useAppStore(
    useShallow((s) => ({
      video: s.video,
      cropRectangle: s.cropRectangle,
      segments: s.segments,
      format: s.format,
      setFormat: s.setFormat,
      preset: s.preset,
      setPreset: s.setPreset,
      frameRate: s.frameRate,
      setFrameRate: s.setFrameRate,
      speed: s.speed,
      setSpeed: s.setSpeed,
      outputWidth: s.outputWidth,
      setOutputWidth: s.setOutputWidth,
      outputHeight: s.outputHeight,
      setOutputHeight: s.setOutputHeight,
      noAudio: s.noAudio,
      setNoAudio: s.setNoAudio,
      multithreading: s.multithreading,
      setMultithreading: s.setMultithreading,
      resetExportOptions: s.resetExportOptions,
    })),
  );

  useEffect(() => {
    if (video) video.playbackRate = speed;
  }, [video, speed]);

  useEffect(() => {
    if (video) video.muted = noAudio;
  }, [video, noAudio]);

  if (!video) return null;

  // Blank inputs show what the export will be; typing pins that axis.
  const size = effectiveOutputSize({
    cropRectangle,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    outputWidth,
    outputHeight,
  });

  const hasChanges =
    format !== DEFAULT_EXPORT.format ||
    preset !== DEFAULT_EXPORT.preset ||
    frameRate !== DEFAULT_EXPORT.frameRate ||
    speed !== DEFAULT_EXPORT.speed ||
    outputWidth !== DEFAULT_EXPORT.outputWidth ||
    outputHeight !== DEFAULT_EXPORT.outputHeight ||
    noAudio !== DEFAULT_EXPORT.noAudio;

  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${id}-width`}
            className="text-xs text-muted-foreground"
          >
            Width
          </label>
          <Input
            id={`${id}-width`}
            type="number"
            className="font-mono text-sm h-8 bg-background"
            value={outputWidth || String(size.width)}
            min={0}
            onChange={(e) => setOutputWidth(e.currentTarget.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${id}-height`}
            className="text-xs text-muted-foreground"
          >
            Height
          </label>
          <Input
            id={`${id}-height`}
            type="number"
            className="font-mono text-sm h-8 bg-background"
            value={outputHeight || String(size.height)}
            min={0}
            onChange={(e) => setOutputHeight(e.currentTarget.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${id}-format`}
          className="text-xs text-muted-foreground"
        >
          Format
        </label>
        <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
          <SelectTrigger id={`${id}-format`} className="h-8 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mp4">mp4</SelectItem>
            <SelectItem value="webm">webm</SelectItem>
            <SelectItem value="mov">mov</SelectItem>
            <SelectItem value="gif">gif</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {format !== "gif" && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${id}-preset`}
            className="text-xs text-muted-foreground"
          >
            Preset
          </label>
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger id={`${id}-preset`} className="h-8 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="ultrafast"
                description="Fastest export, larger file"
              >
                ultrafast
              </SelectItem>
              <SelectItem
                value="fast"
                description="Good balance, leaning speed"
              >
                fast
              </SelectItem>
              <SelectItem value="medium" description="Balanced speed & quality">
                medium
              </SelectItem>
              <SelectItem
                value="slow"
                description="Best quality, slower export"
              >
                slow
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-fps`} className="text-xs text-muted-foreground">
          Frame Rate
        </label>
        <Slider
          id={`${id}-fps`}
          aria-label="Frame Rate"
          value={[frameRate]}
          max={60}
          step={1}
          onValueChange={([value]) => setFrameRate(value)}
        />
        <span className="text-xs text-muted-foreground self-end font-mono">
          {frameRate} fps
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${id}-speed`}
          className="text-xs text-muted-foreground"
        >
          Speed
        </label>
        <Slider
          id={`${id}-speed`}
          aria-label="Speed"
          value={[speed]}
          min={0.25}
          max={2}
          step={0.25}
          onValueChange={([value]) => setSpeed(value)}
        />
        <span className="text-xs text-muted-foreground self-end font-mono">
          {speed}x
        </span>
      </div>

      {format !== "gif" && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={`${id}-no-audio`}
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Remove audio
          </label>
          <Switch
            id={`${id}-no-audio`}
            checked={noAudio}
            onCheckedChange={setNoAudio}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <label
          htmlFor={`${id}-multithreading`}
          className="text-xs text-muted-foreground cursor-pointer"
        >
          Multithreading
        </label>
        {supportsMultithreading ? (
          <Switch
            id={`${id}-multithreading`}
            checked={multithreading}
            onCheckedChange={setMultithreading}
          />
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Switch
                    id={`${id}-multithreading`}
                    checked={false}
                    disabled
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Not supported in this browser</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {hasChanges && (
        <Button
          variant="link"
          className="text-xs h-min p-0 text-primary self-end"
          onClick={resetExportOptions}
        >
          Reset
        </Button>
      )}

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${id}-duration`}
          className="text-xs text-muted-foreground"
        >
          Output Duration
        </label>
        <Input
          id={`${id}-duration`}
          type="text"
          className="font-mono text-sm h-8 bg-background"
          value={secondsToDuration(
            segments.reduce(
              (sum, seg) => sum + (seg.sourceEnd - seg.sourceStart),
              0,
            ),
            { ms: true, compact: video.duration < 45 * 60 },
          )}
          readOnly
        />
      </div>

      <VideoExportDialog>
        <Button className="w-full mt-2">
          <FileOutput className="h-4 w-4 mr-1.5" />
          Export
        </Button>
      </VideoExportDialog>
    </div>
  );
};

export default ExportPanel;
