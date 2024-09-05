import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useReactMediaRecorder } from "react-media-recorder";
import { cn, isMobile } from "../lib/utils";
import { Video } from "lucide-react";

interface ScreenRecorderProps {
  onDone: (file: Blob) => void;
}

const ScreenRecorder = ({ onDone }: ScreenRecorderProps) => {
  const screen = useReactMediaRecorder({
    screen: !isMobile,
    onStop: (_, blob) => onDone(blob),
    selfBrowserSurface: "exclude",
    mediaRecorderOptions: { mimeType: "video/mp4" },
  });

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && screen.previewStream) {
      videoRef.current.srcObject = screen.previewStream;
    }
  }, [screen.previewStream]);

  return (
    <div className="flex flex-col gap-4 justify-center relative">
      <Video
        className={cn(
          "absolute top-[50%] left-[50%] transform -translate-x-[50%] -translate-y-[50%] h-20 w-20 text-primary",
          screen.status === "recording" && "hidden",
        )}
      />
      <video
        ref={videoRef}
        className="w-full h-full shadow"
        autoPlay
        playsInline
        muted
      />

      {screen.status !== "recording" && (
        <div className="flex gap-2 justify-end">
          <Button
            variant="secondary"
            onClick={async () => {
              screen.stopRecording();
              onDone(null!);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              screen.startRecording();
            }}
          >
            Start Recording
          </Button>
        </div>
      )}
      {screen.status === "recording" && (
        <Button
          variant="destructive"
          onClick={async () => {
            screen.stopRecording();
          }}
        >
          Stop Recording
        </Button>
      )}
    </div>
  );
};

export default ScreenRecorder;
