import { useAppStore } from "@/store.tsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Clapperboard, ScreenShare, Webcam } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useReactMediaRecorder } from "react-media-recorder";

const NewVideo = () => {
  const { setFile } = useAppStore();

  const [mode, setMode] = useState<"file" | "video" | "screen">("file");

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

  const onStop = async (_blobUrl: string, blob: Blob) => {
    setFile(blob);
  };

  const video = useReactMediaRecorder({
    video: true,
    onStart: () => setMode("video"),
    onStop,
    mediaRecorderOptions: { mimeType: "video/mp4" },
  });
  const screen = useReactMediaRecorder({
    screen: true,
    onStart: () => setMode("screen"),
    onStop,
    selfBrowserSurface: "exclude",
    mediaRecorderOptions: { mimeType: "video/mp4" },
  });

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && video.previewStream) {
      videoRef.current.srcObject = video.previewStream;
    }
  }, [video.previewStream]);

  return (
    <div className="h-full flex flex-col items-center">
      <div className="flex flex-col items-center mt-4 sm:mt-10">
        <h1 className="flex gap-4 items-center text-8xl">
          <Clapperboard width={128} height={128} />
          yava
        </h1>
        <h2 className="self-end text-sm -mt-6 mr-0.5">yet another video app</h2>
      </div>
      <div className="mt-8 sm:mt-16 mb-6 sm:mb-10 md:mb-16 text-center">
        Trim, cut, crop, resize and export video files{" "}
        <span className="underline">directly from your browser</span>.{" "}
        Everything is processed locally,{" "}
        <span className="font-bold">nothing leaves your device</span>!
      </div>

      <div className="w-full sm:w-[80vw] md:w-[70vw] lg:w-[60vw] xl:w-[50vw] h-[40vh] sm:h-[50vh] flex justify-center">
        {mode === "file" && (
          <div
            className={cn(
              "flex-1 bg-secondary border-2 border-dashed rounded flex flex-col items-center justify-center gap-10 md:gap-20 p-10",
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
                className="gap-1 mx-1"
                onClick={() => {
                  screen.startRecording();
                }}
              >
                <ScreenShare width={12} height={12} /> screen
              </Button>
              or your
              <Button
                variant="outline"
                size="sm"
                className="gap-1 mx-2"
                onClick={() => {
                  video.startRecording();
                }}
              >
                <Webcam width={12} height={12} /> webcam
              </Button>
              if your device supports it.
            </div>
          </div>
        )}
        {(mode === "video" || mode === "screen") && (
          <div className="flex flex-col gap-2 items-center justify-center">
            <video ref={videoRef} className="w-full h-full" autoPlay controls />

            <Button
              onClick={async () => {
                const source = mode === "video" ? video : screen;
                source.stopRecording();
              }}
            >
              Stop Recording
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewVideo;
