import { useAppStore } from "@/store.tsx";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils.ts";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import VideoExportDialog from "@/components/export/VideoExportDialog.tsx";

const ExportPanel = () => {
  const { video, cropRectangle, setCropRectangle } = useAppStore();

  const [format, setFormat] = useState("mp4");
  const [frameRate, setFrameRate] = useState(30);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [noAudio, setNoAudio] = useState(false);

  useEffect(() => {
    if (video) {
      setWidth(String(video.videoWidth));
      setHeight(String(video.videoHeight));
    }
  }, [video]);

  if (!video) return null;

  const hasChanges =
    cropRectangle.x > 0 ||
    cropRectangle.y > 0 ||
    cropRectangle.w > 0 ||
    cropRectangle.h > 0 ||
    format !== "mp4" ||
    frameRate !== 30 ||
    width !== String(video.videoWidth) ||
    height !== String(video.videoHeight) ||
    noAudio;

  const resetAll = () => {
    setCropRectangle({ x: 0, y: 0, w: 0, h: 0, vw: 0, vh: 0 });
    setFormat("mp4");
    setFrameRate(30);
    setWidth(String(video.videoWidth));
    setHeight(String(video.videoHeight));
    setNoAudio(false);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Crop & Export
        </h3>
        <Button
          variant="link"
          className={cn(
            "text-xs h-min p-0 text-primary invisible",
            hasChanges && "visible",
          )}
          onClick={resetAll}
        >
          Reset
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">x</label>
            <Input
              type="number"
              className="font-mono text-sm h-8 bg-background"
              value={cropRectangle.x}
              min={0}
              onChange={(e) => {
                let value = +e.currentTarget.value;
                if (value < 0) value = 0;
                setCropRectangle({ ...cropRectangle, x: value });
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">y</label>
            <Input
              type="number"
              className="font-mono text-sm h-8 bg-background"
              value={cropRectangle.y}
              min={0}
              onChange={(e) => {
                let value = +e.currentTarget.value;
                if (value < 0) value = 0;
                setCropRectangle({ ...cropRectangle, y: value });
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Width</label>
            <Input
              type="text"
              className="font-mono text-sm h-8 bg-background"
              value={width}
              onChange={(e) => setWidth(e.currentTarget.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Height</label>
            <Input
              type="text"
              className="font-mono text-sm h-8 bg-background"
              value={height}
              onChange={(e) => setHeight(e.currentTarget.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Format</label>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="h-8 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mp4">mp4</SelectItem>
              <SelectItem value="gif">gif</SelectItem>
            </SelectContent>
          </Select>
        </div>

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

        {format === "mp4" && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="no-audio"
              checked={noAudio}
              onCheckedChange={(checked) => setNoAudio(!!checked)}
            />
            <label
              htmlFor="no-audio"
              className={cn("text-sm text-muted-foreground cursor-pointer")}
            >
              Remove audio
            </label>
          </div>
        )}
      </div>

      <VideoExportDialog
        format={format}
        frameRate={frameRate}
        width={width}
        height={height}
        noAudio={noAudio}
      >
        <Button className="w-full mt-2">Export</Button>
      </VideoExportDialog>
    </div>
  );
};

export default ExportPanel;
