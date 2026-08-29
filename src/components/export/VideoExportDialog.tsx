import { useAppStore } from "@/store.tsx";
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button.tsx";
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
import { type ExportSettings } from "@/lib/export-command.ts";
import { runExport } from "@/lib/export-run.ts";

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
  const [error, setError] = useState("");

  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [, setTime] = useState(0);

  /** Identifies the in-flight run, so a cancelled one cannot report anything. */
  const runIdRef = useRef(0);

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
    const runId = ++runIdRef.current;

    setExporting(true);
    setError("");

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
      await load().catch((e) => {
        throw new Error(
          "Could not load the video encoder. Check your connection and try again.",
          { cause: e },
        );
      });

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

      const data = await runExport({
        ffmpeg,
        input: new Uint8Array(await file!.arrayBuffer()),
        settings,
        segments,
      });

      if (runId !== runIdRef.current) return;

      setOutputUrl(
        URL.createObjectURL(
          new Blob([data], { type: MIME_TYPES[format] ?? "video/mp4" }),
        ),
      );
    } catch (e) {
      // A cancelled run rejects because the dialog terminated FFmpeg.
      if (runId !== runIdRef.current) return;

      setError(
        e instanceof Error
          ? e.message
          : "The export failed. The log below may say why.",
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
    setError("");
    setLog([]);
    setProgress(0);
    setTime(0);
  };

  const onOpenChange = (open: boolean) => {
    if (!open) {
      reset();
      if (exporting) {
        // Retires the run so its rejection stays silent.
        runIdRef.current++;
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
            {error
              ? "Export Failed"
              : outputUrl
                ? "Export Complete"
                : "Exporting..."}
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

              {error && (
                <p className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
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
            {outputUrl || error ? "Close" : "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VideoExportDialog;
