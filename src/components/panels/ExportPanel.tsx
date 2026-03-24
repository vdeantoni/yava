import { useAppStore, type Format, type Preset } from "@/store.tsx";
import { useEffect } from "react";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Switch } from "@/components/ui/switch.tsx";
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
  const {
    video,
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
  } = useAppStore();

  useEffect(() => {
    if (video) {
      setOutputWidth(String(video.videoWidth));
      setOutputHeight(String(video.videoHeight));
    }
  }, [video, setOutputWidth, setOutputHeight]);

  useEffect(() => {
    if (video) video.playbackRate = speed;
  }, [video, speed]);

  useEffect(() => {
    if (video) video.muted = noAudio;
  }, [video, noAudio]);

  if (!video) return null;

  const hasChanges =
    format !== "mp4" ||
    preset !== "ultrafast" ||
    frameRate !== 30 ||
    speed !== 1 ||
    outputWidth !== String(video.videoWidth) ||
    outputHeight !== String(video.videoHeight) ||
    noAudio;

  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Width</label>
          <Input
            type="text"
            className="font-mono text-sm h-8 bg-background"
            value={outputWidth}
            onChange={(e) => setOutputWidth(e.currentTarget.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Height</label>
          <Input
            type="text"
            className="font-mono text-sm h-8 bg-background"
            value={outputHeight}
            onChange={(e) => setOutputHeight(e.currentTarget.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Format</label>
        <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
          <SelectTrigger className="h-8 bg-background">
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
          <label className="text-xs text-muted-foreground">Preset</label>
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="h-8 bg-background">
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
        <label className="text-xs text-muted-foreground">Frame Rate</label>
        <Slider
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
        <label className="text-xs text-muted-foreground">Speed</label>
        <Slider
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
            htmlFor="no-audio"
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Remove audio
          </label>
          <Switch
            id="no-audio"
            checked={noAudio}
            onCheckedChange={setNoAudio}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <label
          htmlFor="multithreading"
          className="text-xs text-muted-foreground cursor-pointer"
        >
          Multithreading
        </label>
        {supportsMultithreading ? (
          <Switch
            id="multithreading"
            checked={multithreading}
            onCheckedChange={setMultithreading}
          />
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Switch id="multithreading" checked={false} disabled />
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
