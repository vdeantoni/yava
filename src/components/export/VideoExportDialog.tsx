import { useAppStore } from "@/store.tsx";
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
import {
  buildConcatArgs,
  buildConcatList,
  buildSegmentArgs,
  type ExportSettings,
} from "@/lib/export-command.ts";

const CONCAT_LIST = "concat_list.txt";

const MIME_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  gif: "image/gif",
};

const VideoExportDialog = ({ children }: PropsWithChildren) => {
  const {
    file,
    ffmpeg,
    video,
    cursorStart,
    cursorEnd,
    segments,
    cropRectangle,
    format,
    preset,
    frameRate,
    speed,
    outputWidth,
    outputHeight,
    noAudio,
    multithreading,
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

      const settings: ExportSettings = {
        format,
        preset,
        frameRate,
        speed,
        outputWidth,
        outputHeight,
        noAudio,
        multithreading,
        cropRectangle,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      };

      if (segments.length <= 1) {
        // Single segment — original export path
        await ffmpeg.exec(
          buildSegmentArgs(settings, {
            input: name,
            start: cursorStart,
            duration: cursorEnd - cursorStart,
            output: filename,
          }),
        );
      } else {
        // Multi-segment — extract each, then concat
        const segmentFiles: string[] = [];

        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const segFile = `segment_${i}.${format}`;
          segmentFiles.push(segFile);

          await ffmpeg.exec(
            buildSegmentArgs(settings, {
              input: name,
              start: seg.sourceStart,
              duration: seg.sourceEnd - seg.sourceStart,
              output: segFile,
            }),
          );
        }

        // Write concat list to WASM filesystem
        await ffmpeg.writeFile(
          CONCAT_LIST,
          new TextEncoder().encode(buildConcatList(segmentFiles)),
        );

        // Concatenate with stream copy
        await ffmpeg.exec(buildConcatArgs(CONCAT_LIST, filename));

        // Clean up intermediate files
        for (const f of segmentFiles) {
          await ffmpeg.deleteFile(f);
        }
        await ffmpeg.deleteFile(CONCAT_LIST);
      }

      const data = (await ffmpeg.readFile(filename)) as Uint8Array<ArrayBuffer>;
      setOutputUrl(
        URL.createObjectURL(
          new Blob([data], {
            type: MIME_TYPES[format] ?? "video/mp4",
          }),
        ),
      );

      // Clean up WASM filesystem to free memory between exports
      await ffmpeg.deleteFile(name);
      await ffmpeg.deleteFile(filename);
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
        className="max-h-full overflow-auto"
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
                  {/* Bound both axes on the media itself. The container has no
                      definite height, so h-full here wouldn't resolve and the
                      element would lay out at its intrinsic size (2560px wide
                      for a 1440p export) and overflow the dialog. */}
                  <div className="flex justify-center">
                    {format === "gif" && (
                      <img
                        ref={outputImageRef}
                        className="max-h-[35vh] max-w-full rounded shadow"
                      />
                    )}
                    {format !== "gif" && (
                      <video
                        ref={outputVideoRef}
                        className="max-h-[35vh] max-w-full rounded shadow"
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
