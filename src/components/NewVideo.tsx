import { useAppStore } from "@/store.tsx";
import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Clapperboard, ScreenShare, Webcam } from "lucide-react";
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

  return (
    <div className="flex-1 flex flex-col items-center">
      <div className="flex flex-col items-center mt-4 sm:mt-10">
        <h1 className="flex gap-4 items-center text-8xl">
          <Clapperboard width={128} height={128} />
          yava
        </h1>
        <h2 className="self-end text-sm -mt-6 mr-0.5">yet another video app</h2>
      </div>
      <div className="mt-8 sm:mt-16 mb-6 sm:mb-10 md:mb-16 text-center">
        Trim, cut, crop, resize and export video files. You can select a file
        from your{" "}
        <button className="underline" onClick={open}>
          device
        </button>
        , record your{" "}
        <button className="underline" onClick={() => setMode("camera")}>
          camera
        </button>
        , and even capture your{" "}
        <button className="underline" onClick={() => setMode("screen")}>
          screen
        </button>
        . <br />
        Everything is processed locally,{" "}
        <span className="font-bold">no data is collected</span>.
      </div>

      <div className="w-full sm:w-[80vw] md:w-[70vw] lg:w-[60vw] xl:w-[50vw] h-[40vh] sm:h-[50vh] flex justify-center">
        {mode === "file" && (
          <div
            className={cn(
              "flex-1 flex flex-col items-center justify-center bg-secondary border-2 border-dashed rounded gap-8 md:gap-12 lg:gap-20 p-2 md:p-4 lg:p-10",
              isDragActive && "border-primary",
            )}
            {...getRootProps()}
          >
            <Input {...getInputProps()} />
            <div className="text-sm text-center">
              Drag and drop a video file here, or
              <Button variant="link" className="text-sm p-1" onClick={open}>
                select
              </Button>
              one.
            </div>
            <div className="text-sm text-center">
              You can also record a
              <Button
                variant="outline"
                size="sm"
                className="gap-1 mx-2"
                onClick={() => {
                  setMode("camera");
                }}
              >
                <Webcam width={12} height={12} /> camera
              </Button>
              or capture a
              <Button
                variant="outline"
                size="sm"
                className="gap-1 mx-1"
                onClick={() => {
                  setMode("screen");
                }}
              >
                <ScreenShare width={12} height={12} /> screen
              </Button>
              if your device supports it.
            </div>
          </div>
        )}
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
    </div>
  );
};

export default NewVideo;
