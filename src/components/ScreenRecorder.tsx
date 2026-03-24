import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useReactMediaRecorder } from "react-media-recorder";
import { isMobile } from "../lib/utils";
import { Monitor, MonitorX } from "lucide-react";

interface ScreenRecorderProps {
  onDone: (file: Blob) => void;
  onCancel: () => void;
}

const ScreenRecorder = ({ onDone, onCancel }: ScreenRecorderProps) => {
  const [started, setStarted] = useState(false);

  const screen = useReactMediaRecorder({
    screen: !isMobile,
    video: { displaySurface: "window" },
    onStop: (_, blob) => {
      if (blob?.size) onDone(blob);
    },
    mediaRecorderOptions: { mimeType: "video/mp4" },
  });

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && screen.previewStream) {
      videoRef.current.srcObject = screen.previewStream;
    }
  }, [screen.previewStream]);

  const startCapture = () => {
    setStarted(true);
    screen.startRecording();
  };

  const hasError =
    started &&
    (screen.status === "idle" ||
      screen.status === "permission_denied" ||
      screen.status === "no_specified_media_found");

  if (!started || hasError) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        {hasError ? (
          <>
            <MonitorX className="h-16 w-16 text-destructive" />
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm font-medium">Screen capture failed</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Screen capture was cancelled or denied. Please try again.
              </p>
            </div>
          </>
        ) : (
          <>
            <Monitor className="h-16 w-16 text-muted-foreground" />
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm text-muted-foreground max-w-xs">
                Your browser will ask you to pick a screen, window, or tab.
                Recording starts after selection.
              </p>
            </div>
          </>
        )}
        <Button onClick={startCapture}>
          {hasError ? "Try Again" : "Allow Screen Capture"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <video
        ref={videoRef}
        className="w-full h-full shadow rounded"
        autoPlay
        playsInline
        muted
      />
      <Button
        variant="destructive"
        onClick={() => screen.stopRecording()}
      >
        Stop Recording
      </Button>
    </div>
  );
};

export default ScreenRecorder;
