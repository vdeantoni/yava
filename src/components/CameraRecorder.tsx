import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useReactMediaRecorder } from "react-media-recorder";
import { Video } from "lucide-react";
import { cn } from "../lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { noop } from "lodash";

interface CameraRecorderProps {
  onDone: (file: Blob) => void;
}

const CameraRecorder = ({ onDone }: CameraRecorderProps) => {
  const [videoDevices, setVideoDevices] = useState<
    {
      deviceId: string;
      label: string;
    }[]
  >([]);

  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>();

  const [recording, setRecording] = useState(false);

  const switchingDevices = useRef(false);

  const video = useReactMediaRecorder({
    video: { deviceId: selectedVideoDeviceId },
    onStart: () => {
      setRecording(true);
      switchingDevices.current = false;
    },
    onStop: (_: string, blob: Blob) => {
      setRecording(false);
      return !switchingDevices.current ? onDone(blob) : noop();
    },
    mediaRecorderOptions: { mimeType: "video/mp4" },
    stopStreamsOnStop: true,
  });

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    switchingDevices.current = true;
    video.stopRecording();
    if (selectedVideoDeviceId) {
      video.startRecording();
    }
  }, [selectedVideoDeviceId]);

  useEffect(() => {
    if (videoRef.current && video.previewStream) {
      videoRef.current.srcObject = video.previewStream;
    }
  }, [video.previewStream]);

  useEffect(() => {
    if (!recording || videoDevices.length) {
      return;
    }

    const enumerateDevices = async () => {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();

      const videoDevices = mediaDevices
        .filter((device) => device.kind === "videoinput" && device.deviceId)
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label,
        }));

      setVideoDevices(videoDevices);
      setSelectedVideoDeviceId(videoDevices[0].deviceId);
    };

    enumerateDevices();
  }, [recording, videoDevices]);

  return (
    <div className="flex-1 flex flex-col gap-2">
      {selectedVideoDeviceId && (
        <div>
          <Select
            value={selectedVideoDeviceId}
            onValueChange={setSelectedVideoDeviceId}
          >
            <SelectTrigger className="">
              <SelectValue placeholder="Camera" />
            </SelectTrigger>
            <SelectContent>
              {videoDevices.map((d) => (
                <SelectItem
                  key={d.deviceId}
                  value={d.deviceId}
                >{`${d.label} (${d.deviceId.substring(0, 7)})`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className={cn("flex flex-col gap-2 justify-center relative")}>
        <Video
          className={cn(
            "absolute top-[50%] left-[50%] transform -translate-x-[50%] -translate-y-[80%] h-20 w-20 text-primary",
            recording && "hidden",
          )}
        />

        <video
          ref={videoRef}
          className="w-full h-full shadow"
          autoPlay
          playsInline
          muted
        />

        {!recording && (
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={async () => {
                switchingDevices.current = true;
                video.stopRecording();
                onDone(null!);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                video.startRecording();
              }}
            >
              Start Recording
            </Button>
          </div>
        )}

        {recording && (
          <Button
            variant="destructive"
            onClick={async () => {
              video.stopRecording();
            }}
          >
            Stop Recording
          </Button>
        )}
      </div>
    </div>
  );
};

export default CameraRecorder;
