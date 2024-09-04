import { useAppStore } from "@/store.tsx";
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn, secondsToDuration } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { fetchFile } from "@ffmpeg/util";
import { Progress } from "@/components/ui/progress.tsx";
// @ts-ignore
import { LogEvent, ProgressEvent } from "@ffmpeg/ffmpeg/dist/esm/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFFmpeg } from "@/hooks/useFFmpeg.ts";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider.tsx";
import { Input } from "@/components/ui/input.tsx";
import { usePrevious } from "@uidotdev/usehooks";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox.tsx";

const VideoExportDialog = ({ children }: PropsWithChildren) => {
  const {
    file,
    video,
    ffmpeg,
    multithreading,
    cursorStart,
    cursorEnd,
    cropRectangle,
  } = useAppStore();

  const outputVideoRef = useRef<HTMLVideoElement>(null);
  const outputImageRef = useRef<HTMLImageElement>(null);

  const [open, setOpen] = useState(false);

  const [format, setFormat] = useState<string>("mp4");
  const [frameRate, setFrameRate] = useState<number>(30);
  const [width, setWidth] = useState<string>(String(video.videoWidth));
  const [height, setHeight] = useState<string>(String(video.videoHeight));
  const [noAudio, setNoAudio] = useState<boolean | "indeterminate">(false);

  const [exporting, setExporting] = useState(false);
  const [outputUrl, setOutputUrl] = useState("");
  const previousOutputUrl = usePrevious(outputUrl);

  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [, setTime] = useState(0);

  const { load } = useFFmpeg(
    useCallback((p) => {
      Object.keys(p).forEach((name) =>
        setLog((log) => log.concat(`Loading ${name}: ${p[name]}%`)),
      );
    }, []),
  );

  useEffect(() => {
    const video = outputVideoRef.current;
    const image = outputImageRef.current;

    URL.revokeObjectURL(previousOutputUrl);

    const el = format === "gif" ? image : video;
    if (!el) {
      return;
    }

    el.src = outputUrl;
  }, [format, outputUrl, previousOutputUrl]);

  const exportHandler = async () => {
    setExporting(true);

    const logCb = ({ message }: LogEvent) => {
      setLog((log) => log.concat(message));
    };

    const progressCb = ({ progress, time }: ProgressEvent) => {
      setProgress(progress);
      setTime(time);
    };

    ffmpeg.on("log", logCb);
    ffmpeg.on("progress", progressCb);

    try {
      // Make sure FFmpeg is loaded
      await load();

      const { name } = file!;
      await ffmpeg.writeFile(name, await fetchFile(file));
      const filename = `output_${new Date().getTime()}.${format}`;

      const videoFilters = [`scale=${width || -1}:${height || -1}:`];
      if (cropRectangle.w && cropRectangle.h) {
        const px = video.videoWidth / cropRectangle.vw;
        const py = video.videoHeight / cropRectangle.vh;

        const x = Math.round(cropRectangle.x * px);
        const y = Math.round(cropRectangle.y * py);
        const w = Math.round(cropRectangle.w * px);
        const h = Math.round(cropRectangle.h * py);

        videoFilters.push(`crop=${w}:${h}:${x}:${y}`);
      }

      console.log(videoFilters);

      await ffmpeg.exec(
        [
          "-i",
          name,
          "-ss",
          String(cursorStart),
          "-to",
          String(cursorEnd),
          frameRate && "-r",
          frameRate && String(frameRate),
          "-vf",
          videoFilters.join(","),

          noAudio && "-an",

          // for some reason this is needed to make multithreading work in chrome
          multithreading && "-c:a",
          multithreading && "copy",
          filename,
        ].filter(Boolean) as string[],
      );

      const data = (await ffmpeg.readFile(filename)) as Uint8Array;
      setOutputUrl(
        URL.createObjectURL(
          new Blob([data.buffer], {
            type: format === "gif" ? "image/gif" : "video/mp4",
          }),
        ),
      );
    } finally {
      ffmpeg.off("log", logCb);
      ffmpeg.off("progress", progressCb);

      setExporting(false);
    }
  };

  const downloadHandler = () => {
    const name = `yava_${new Date().getTime()}_${file!.name}.${format}`;
    const link = document.createElement("a");
    link.download = name;
    link.href = outputUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setOutputUrl("");
    setLog([]);
    setProgress(0);
    setTime(0);
  };

  const onOpenChange = (open: boolean) => {
    if (!open) {
      reset();

      setFormat("mp4");
      setFrameRate(30);
      setWidth(String(video.videoWidth));
      setHeight(String(video.videoHeight));
      setNoAudio(false);

      if (exporting) {
        ffmpeg.terminate();
      }
    }

    setOpen(open);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-full overflow-scroll"
      >
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-6 py-4">
              {!outputUrl && (
                <>
                  <div className="grid grid-cols-3 w-full gap-y-4 gap-x-4">
                    <div className="flex flex-col">
                      <span className={"text-primary"}>Start</span>
                      <span>
                        {secondsToDuration(cursorStart, { ms: true })}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className={"text-primary"}>End</span>
                      <span>{secondsToDuration(cursorEnd, { ms: true })}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className={"text-primary"}>Duration</span>
                      <span>
                        {secondsToDuration(cursorEnd - cursorStart, {
                          ms: true,
                        })}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className={"text-primary"}>Format</span>
                      <RadioGroup value={format} onValueChange={setFormat}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="mp4" id="option-mp4" />
                          <Label htmlFor="option-mp4">mp4</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="gif" id="option-gif" />
                          <Label htmlFor="option-gif">gif</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="col-span-2 flex flex-col gap-1">
                      {cropRectangle.w && cropRectangle.h ? (
                        <>
                          <span
                            className={"flex items-center gap-1 text-primary"}
                          >
                            Crop area (w x h)
                          </span>
                          <span>
                            {Math.round(
                              (cropRectangle.w * video.videoWidth) /
                                cropRectangle.vw,
                            )}{" "}
                            x{" "}
                            {Math.round(
                              (cropRectangle.h * video.videoHeight) /
                                cropRectangle.vh,
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            className={"flex items-center gap-1 text-primary"}
                          >
                            Dimensions (w x h)
                            <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle width={14} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    For original value, or to auto-calulate
                                    ratio leave either field blank
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </span>
                          <div className="flex flex-row gap-1 items-center">
                            <Input
                              type="text"
                              value={width}
                              onChange={(e) => setWidth(e.currentTarget.value)}
                            />
                            x
                            <Input
                              type="text"
                              value={height}
                              onChange={(e) => setHeight(e.currentTarget.value)}
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="col-span-2 flex flex-col gap-1">
                      <span className={"flex items-center gap-1 text-primary"}>
                        Frame rate
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle width={14} />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>For original value enter 0</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </span>
                      <div className="flex flex-col gap-1">
                        <Slider
                          value={[frameRate]}
                          max={60}
                          step={1}
                          onValueChange={([value]) => setFrameRate(value)}
                        />
                        <span className="self-end">{`${frameRate} fps`}</span>
                      </div>
                    </div>

                    {format === "mp4" && (
                      <div className="flex flex-col gap-1">
                        <span className={"text-primary"}>Audio</span>
                        <div className={"flex items-center space-x-2"}>
                          <Checkbox
                            id="no-audio"
                            checked={noAudio}
                            onCheckedChange={setNoAudio}
                          />
                          <label
                            htmlFor="no-audio"
                            className="text-sm text-nowrap"
                          >
                            Remove audio
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {exporting && (
                <div className="flex flex-col gap-1">
                  <span className={"text-primary"}>Progress</span>
                  <Progress
                    value={Math.round(progress * 100)}
                    indeterminate={
                      exporting && (progress < 0.1 || progress > 1)
                    }
                  />
                </div>
              )}

              {outputUrl && (
                <div className="flex flex-col gap-1">
                  <span className={"text-primary"}>Output</span>
                  <div className="max-h-[35vh] flex justify-center">
                    {format === "gif" && (
                      <img
                        ref={outputImageRef}
                        className={cn("h-full shadow")}
                      ></img>
                    )}
                    {format === "mp4" && (
                      <video
                        ref={outputVideoRef}
                        className={cn("h-full shadow")}
                        controls
                        playsInline
                      ></video>
                    )}
                  </div>
                  <Button onClick={downloadHandler}>Download</Button>
                </div>
              )}

              {!!log.length && (
                <div className="flex flex-col gap-1 max-w-full overflow-hidden">
                  <span className={"text-primary"}>Log</span>
                  <Collapsible>
                    <CollapsibleTrigger>
                      <pre className="text-xs text-secondary-foreground whitespace-pre-wrap">
                        {log
                          .reverse()
                          .find((l) => !l.toLowerCase().includes("aborted()"))}
                      </pre>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ScrollArea className={"h-[200px]"}>
                        <pre className="text-xs text-secondary-foreground whitespace-pre-wrap">
                          {log.join("\n")}
                        </pre>
                      </ScrollArea>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={exportHandler}
            className={cn(outputUrl && "hidden")}
            disabled={exporting}
          >
            Export
          </Button>
          <Button
            variant="ghost"
            onClick={reset}
            className={cn(!outputUrl && "hidden")}
          >
            Start over
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VideoExportDialog;
