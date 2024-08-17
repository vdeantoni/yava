import { useAppStore } from "@/store.tsx";
import { PropsWithChildren, useCallback, useRef, useState } from "react";
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

const VideoExportDialog = ({ children }: PropsWithChildren) => {
  const { file, ffmpeg, multithreading, cursorStart, cursorEnd } =
    useAppStore();

  const outputRef = useRef<HTMLVideoElement>(null);

  const [open, setOpen] = useState(false);

  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [time, setTime] = useState(0);

  const { load } = useFFmpeg(
    useCallback((p) => {
      Object.keys(p).forEach((name) =>
        setLog((log) => log.concat(`Loading ${name}: ${p[name]}%`)),
      );
    }, []),
  );

  const exportHandler = async () => {
    // Make sure FFmpeg is loaded
    await load();

    const { name } = file!;
    await ffmpeg.writeFile(name, await fetchFile(file));
    const filename = `output_${new Date().getTime()}.mp4`;

    const logCb = ({ message }: LogEvent) => {
      setLog((log) => log.concat(message));
    };

    const progressCb = ({ progress, time }: ProgressEvent) => {
      setProgress(progress);
      setTime(time);
    };

    ffmpeg.on("log", logCb);
    ffmpeg.on("progress", progressCb);

    await ffmpeg.exec(
      [
        "-i",
        name,
        "-ss",
        String(cursorStart),
        "-to",
        String(cursorEnd),
        // for some reason this is needed to make multithreading work in chrome
        multithreading && "-c:a",
        multithreading && "copy",
        filename,
      ].filter(Boolean) as string[],
    );
    const data = (await ffmpeg.readFile(filename)) as Uint8Array;

    const video = outputRef.current!;
    video.src = URL.createObjectURL(
      new Blob([data.buffer], { type: "video/mp4" }),
    );

    ffmpeg.off("log", logCb);
    ffmpeg.off("progress", progressCb);
  };

  const onOpenChange = (open: boolean) => {
    if (!open) {
      setLog([]);
      setProgress(0);
      setTime(0);

      ffmpeg.terminate();
    }

    setOpen(open);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Export video</DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-col gap-6 py-4">
                <div className="flex justify-between">
                  <div className="flex flex-col">
                    <span className={"text-primary"}>Start</span>
                    <span>{secondsToDuration(cursorStart)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className={"text-primary"}>End</span>
                    <span>{secondsToDuration(cursorEnd)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className={"text-primary"}>Duration</span>
                    <span>{secondsToDuration(cursorEnd - cursorStart)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className={"text-primary"}>Progress</span>
                  <Progress value={Math.round(progress * 100)} />
                  <div className="flex justify-between">
                    <span>{`${Math.round(progress * 100)}%`}</span>
                    <span>{`${secondsToDuration(Math.round(time / 1000000))} elapsed`}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className={"text-primary"}>Output</span>
                  <video
                    ref={outputRef}
                    className={cn("w-full shadow")}
                    controls
                    playsInline
                  ></video>
                </div>
                <div className="flex flex-col gap-1 max-w-full overflow-hidden">
                  <span className={"text-primary"}>Log</span>
                  <Collapsible>
                    <CollapsibleTrigger>
                      <pre className="text-xs text-secondary-foreground whitespace-pre-wrap">
                        {log[log.length - 1]}
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
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={exportHandler}
              disabled={progress > 0 && progress < 100}
            >
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VideoExportDialog;