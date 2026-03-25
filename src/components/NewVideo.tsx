import { useAppStore } from "@/store.tsx";
import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { FileVideo, FolderOpen, MonitorUp, Webcam } from "lucide-react";
import YavaLogo from "@/components/YavaLogo";
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
    <div className="flex-1 flex flex-col items-center p-4">
      {/* Top spacer — pushes content above true center */}
      <div className="flex-[2_0_0%]" />

      {/* Title + description */}
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-1">
          <h1 className="flex gap-3 items-center text-5xl sm:text-7xl font-bold tracking-tight">
            <YavaLogo className="h-16 w-16 sm:h-20 sm:w-20 text-primary" />
            yava
          </h1>
          <p className="text-sm text-foreground/80 self-end">
            yet another video app
          </p>
        </div>

        <p className="text-center text-muted-foreground leading-relaxed max-w-lg">
          Trim, crop, resize and export video files. Everything is processed
          locally,{" "}
          <span className="text-foreground font-medium">
            no files leave your device
          </span>
          .
        </p>
      </div>

      <div className="w-full max-w-2xl mt-10" {...getRootProps()}>
        <Input {...getInputProps()} />

        <div
          className={cn(
            "relative flex flex-col items-center gap-6 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm px-8 py-12 md:p-16 transition-all",
            isDragActive && "border-primary/60 bg-primary/5 scale-[1.01]",
          )}
        >
          {/* Icon */}
          <div
            className={cn(
              "flex items-center justify-center w-16 h-16 rounded-xl bg-primary/15 transition-all duration-500",
              isDragActive && "scale-0 h-0 bg-primary/25",
            )}
          >
            <FileVideo
              className={cn(
                "h-8 w-8 text-primary transition-transform",
                isDragActive && "scale-110",
              )}
            />
          </div>

          {/* Heading */}
          <div className="flex flex-col items-center gap-8">
            <h2
              className="text-3xl md:text-4xl font-bold tracking-tight text-center"
            >
              {isDragActive ? "Drop!" : "Ready?"}
            </h2>
            <p
              className={cn(
                "text-muted-foreground text-center max-w-md",
                isDragActive && "invisible",
              )}
            >
              Drag and drop your video files, record your camera or capture your
              screen to begin editing in the browser.
            </p>
          </div>

          {/* Action buttons */}
          <div
            className={cn(
              "flex items-stretch gap-3 w-full max-w-md mt-2 transition-opacity",
              isDragActive && "opacity-0 pointer-events-none",
            )}
          >
            <Button
              size="lg"
              className="flex-1 h-14 gap-2 text-sm font-semibold uppercase tracking-wider"
              onClick={open}
            >
              <FolderOpen className="h-4 w-4" />
              Browse Files
            </Button>
            <Button
              variant="secondary"
              className="h-14 w-14 shrink-0 flex flex-col gap-1 p-0"
              onClick={() => setMode("camera")}
            >
              <Webcam className="h-4 w-4" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Record
              </span>
            </Button>
            <Button
              variant="secondary"
              className="h-14 w-14 shrink-0 flex flex-col gap-1 p-0"
              onClick={() => setMode("screen")}
            >
              <MonitorUp className="h-4 w-4" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Screen
              </span>
            </Button>
          </div>

          {/* Feature badges */}
          <div
            className={cn(
              "flex flex-wrap items-center justify-center gap-x-6 gap-y-1 mt-2 transition-opacity",
              isDragActive && "opacity-0",
            )}
          >
            {["FFmpeg", "No uploads", "WASM"].map((label) => (
              <span
                key={label}
                className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Supported formats */}
        <div className="flex items-center justify-center gap-8 mt-6">
          {["MP4", "MOV", "WEBM", "GIF"].map((fmt) => (
            <span key={fmt} className="flex flex-col items-center gap-1">
              <span className="text-xs font-mono tracking-[0.2em] text-muted-foreground/50">
                {fmt}
              </span>
              <span className="w-4 h-0.5 rounded-full bg-primary/30" />
            </span>
          ))}
        </div>
      </div>

      {/* Bottom spacer — larger than top for optical centering */}
      <div className="flex-[3_0_0%]" />

      {(mode === "screen" || mode === "camera") && (
        <Dialog open={true} onOpenChange={() => setMode("file")}>
          <DialogContent
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
                  onCancel={() => setMode("file")}
                />
              )}
              {mode === "camera" && (
                <CameraRecorder
                  onDone={(file) => {
                    setFile(file);
                    setMode("file");
                  }}
                  onCancel={() => setMode("file")}
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
