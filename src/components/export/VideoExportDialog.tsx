import { useAppStore } from "@/store.tsx";
import { PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { fetchFile } from "@ffmpeg/util";
import { Progress } from "@/components/ui/progress.tsx";
// @ts-expect-error no type declarations available
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
import { Download } from "lucide-react";

const VideoExportDialog = ({ children }: PropsWithChildren) => {
  const {
    file,
    video,
    ffmpeg,
    cursorStart,
    cursorEnd,
    cropRectangle,
    format,
    frameRate,
    speed,
    outputWidth,
    outputHeight,
    noAudio,
  } = useAppStore();

  const outputVideoRef = useRef<HTMLVideoElement>(null);
  const outputImageRef = useRef<HTMLImageElement>(null);

  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [outputUrl, setOutputUrl] = useState("");

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

  const previousOutputUrlRef = useRef("");
  useEffect(() => {
    const video = outputVideoRef.current;
    const image = outputImageRef.current;

    URL.revokeObjectURL(previousOutputUrlRef.current);
    previousOutputUrlRef.current = outputUrl;

    const el = format === "gif" ? image : video;
    if (!el) return;

    el.src = outputUrl;
  }, [format, outputUrl]);

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
      await load();

      const name = "video_file";

      await ffmpeg.writeFile(name, await fetchFile(file));
      const filename = `output_${new Date().getTime()}.${format}`;

      const videoFilters = [
        `scale=${outputWidth || -1}:${outputHeight || -1}:`,
      ];
      if (cropRectangle.w && cropRectangle.h) {
        const px = video.videoWidth / cropRectangle.vw;
        const py = video.videoHeight / cropRectangle.vh;

        const x = Math.round(cropRectangle.x * px);
        const y = Math.round(cropRectangle.y * py);
        const w = Math.round(cropRectangle.w * px);
        const h = Math.round(cropRectangle.h * py);

        videoFilters.push(`crop=${w}:${h}:${x}:${y}`);
      }
      if (speed !== 1) {
        videoFilters.push(`setpts=${(1 / speed).toFixed(4)}*PTS`);
      }

      const audioFilters: string[] = [];
      if (speed !== 1 && !noAudio) {
        let remaining = speed;
        while (remaining > 2) {
          audioFilters.push("atempo=2.0");
          remaining /= 2;
        }
        while (remaining < 0.5) {
          audioFilters.push("atempo=0.5");
          remaining /= 0.5;
        }
        audioFilters.push(`atempo=${remaining.toFixed(4)}`);
      }

      const trimDuration = cursorEnd - cursorStart;

      await ffmpeg.exec(
        [
          "-ss",
          String(cursorStart),
          "-i",
          name,
          "-t",
          String(trimDuration),
          frameRate && "-r",
          frameRate && String(frameRate),
          "-vf",
          videoFilters.join(","),

          audioFilters.length && "-af",
          audioFilters.length && audioFilters.join(","),

          noAudio && "-an",

          !noAudio && !audioFilters.length && "-c:a",
          !noAudio && !audioFilters.length && "copy",

          format === "mp4" && "-preset",
          format === "mp4" && "ultrafast",

          filename,
        ].filter(Boolean) as string[],
      );

      const data = (await ffmpeg.readFile(filename)) as Uint8Array<ArrayBuffer>;
      setOutputUrl(
        URL.createObjectURL(
          new Blob([data], {
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
    const name = `yava_${new Date().getTime()}.${format}`;
    const link = document.createElement("a");
    link.download = name;
    link.href = outputUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    URL.revokeObjectURL(previousOutputUrlRef.current);
    previousOutputUrlRef.current = "";
    setOutputUrl("");
    setLog([]);
    setProgress(0);
    setTime(0);
  };

  const onOpenChange = (open: boolean) => {
    if (!open) {
      reset();
      if (exporting) {
        ffmpeg.terminate();
      }
    } else {
      exportHandler();
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
          <DialogTitle>
            {outputUrl ? "Export Complete" : "Exporting..."}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-4 py-4">
              {exporting && (
                <div className="flex flex-col gap-2">
                  <Progress
                    value={Math.round(progress * 100)}
                    indeterminate={
                      exporting && (progress < 0.1 || progress > 1)
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    {Math.round(progress * 100)}%
                  </span>
                </div>
              )}

              {outputUrl && (
                <div className="flex flex-col gap-3">
                  <div className="max-h-[35vh] flex justify-center">
                    {format === "gif" && (
                      <img
                        ref={outputImageRef}
                        className={cn("h-full shadow rounded")}
                      />
                    )}
                    {format === "mp4" && (
                      <video
                        ref={outputVideoRef}
                        className={cn("h-full shadow rounded")}
                        controls
                        playsInline
                      />
                    )}
                  </div>
                  <Button onClick={downloadHandler}>
                    <Download className="h-4 w-4 mr-1.5" />
                    Download
                  </Button>
                </div>
              )}

              {!!log.length && (
                <div className="flex flex-col gap-1 max-w-full overflow-hidden">
                  <Collapsible>
                    <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground">
                      <pre className="whitespace-pre-wrap text-left">
                        {log.findLast(
                          (l) => !l.toLowerCase().includes("aborted()"),
                        )}
                      </pre>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ScrollArea className="h-[200px]">
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
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
            {outputUrl ? "Close" : "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VideoExportDialog;
