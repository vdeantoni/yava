import { useAppStore } from "@/store.tsx";
import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Clapperboard, ScreenShare, Upload, Webcam } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ScreenRecorder from "./ScreenRecorder";
import CameraRecorder from "./CameraRecorder";

const NewVideo = () => {
  const { setFile } = useAppStore();

  const [mode, setMode] = useState<"file" | "camera" | "screen">("file");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!acceptedFiles?.length) {
      return;
    }

    setFile(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "video/*": [],
    },
    multiple: false,
    noClick: true,
    noKeyboard: true,
  });

  useEffect(() => {
    const controller = new AbortController();

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData;
      if (!items) return;

      // Check for pasted video files
      const files = Array.from(items.files);
      const videoFile = files.find((f) => f.type.startsWith("video/"));
      if (videoFile) {
        e.preventDefault();
        setFile(videoFile);
        return;
      }

      // Check for pasted text (URL)
      const text = items.getData("text/plain").trim();
      if (!text) return;

      // Only attempt fetch for valid URLs
      try {
        new URL(text);
      } catch {
        return;
      }

      e.preventDefault();
      try {
        const response = await fetch(text, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const blob = await response.blob();
        if (blob.type.startsWith("video/")) {
          setFile(blob);
        }
      } catch {
        // Fetch failed (CORS, network, abort, etc.) — ignore silently
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
      controller.abort();
    };
  }, [setFile]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Title + description — positioned above the box */}
      <div className="absolute left-0 right-0 bottom-[min(calc(50%+28vh),calc(100%-12rem))] flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-1">
          <h1 className="flex gap-3 items-center text-5xl sm:text-7xl font-bold tracking-tight">
            <Clapperboard className="h-12 w-12 sm:h-16 sm:w-16 text-primary" />
            yava
          </h1>
          <p className="text-sm text-foreground/80 self-end">
            yet another video app
          </p>
        </div>

        <p className="text-center text-muted-foreground leading-relaxed max-w-md">
          Trim, crop, resize and export video files. Everything is processed
          locally,{" "}
          <span className="text-foreground font-medium">
            no files leave your device
          </span>
          .
        </p>
      </div>

      {/* Upload box — truly centered */}
      <div className="w-full max-w-2xl">
        <div
          className={cn(
            "w-full h-[40vh] min-h-[200px] flex flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed border-border bg-card/30 transition-colors",
            isDragActive && "border-primary bg-primary/5",
          )}
          {...getRootProps()}
        >
          <Input {...getInputProps()} />

          <Upload className="h-10 w-10 text-muted-foreground" />

          <div className="text-sm text-muted-foreground text-center">
            Drag and drop a video file here, or
            <Button
              variant="link"
              className="text-sm p-1 text-primary"
              onClick={open}
            >
              browse
            </Button>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setMode("camera")}
            >
              <Webcam className="h-3.5 w-3.5" /> Record camera
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setMode("screen")}
            >
              <ScreenShare className="h-3.5 w-3.5" /> Capture screen
            </Button>
          </div>
        </div>
      </div>

      {(mode === "screen" || mode === "camera") && (
        <Dialog open={true}>
          <DialogContent
            onEscapeKeyDown={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="max-h-full overflow-scroll"
          >
            <DialogHeader>
              <DialogTitle>
                Record {mode === "camera" ? "Camera" : "Screen"}
              </DialogTitle>
              <DialogDescription></DialogDescription>
            </DialogHeader>
            <div>
              {mode === "screen" && (
                <ScreenRecorder
                  onDone={(file) => {
                    setFile(file);
                    setMode("file");
                  }}
                />
              )}
              {mode === "camera" && (
                <CameraRecorder
                  onDone={(file) => {
                    setFile(file);
                    setMode("file");
                  }}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default NewVideo;
