import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useReactMediaRecorder } from "react-media-recorder";
import { Camera, ShieldAlert, Video } from "lucide-react";
import { cn } from "../lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Permission = "prompt" | "granted" | "denied";

interface CameraRecorderProps {
  onDone: (file: Blob) => void;
  onCancel: () => void;
}

const CameraRecorder = ({ onDone, onCancel }: CameraRecorderProps) => {
  const [permission, setPermission] = useState<Permission>("prompt");
  const [videoDevices, setVideoDevices] = useState<
    { deviceId: string; label: string }[]
  >([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>();
  const [recording, setRecording] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const previewRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  const recorder = useReactMediaRecorder({
    video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
    onStop: (_: string, blob: Blob) => {
      setRecording(false);
      onDone(blob);
    },
    mediaRecorderOptions: { mimeType: "video/mp4" },
    stopStreamsOnStop: true,
  });

  // Check permission on mount
  useEffect(() => {
    let status: PermissionStatus | null = null;
    const onChange = () => setPermission(status!.state as Permission);
    (async () => {
      try {
        status = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        setPermission(status.state as Permission);
        status.addEventListener("change", onChange);
      } catch {
        // Safari doesn't support permissions.query for camera
      }
    })();
    return () => status?.removeEventListener("change", onChange);
  }, []);

  // Enumerate devices when permission is granted
  const enumerateDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices
      .filter((d) => d.kind === "videoinput" && d.deviceId)
      .map((d) => ({ deviceId: d.deviceId, label: d.label }));
    setVideoDevices(cameras);
    if (cameras.length) {
      setSelectedDeviceId((prev) => prev ?? cameras[0].deviceId);
    }
  }, []);

  useEffect(() => {
    if (permission === "granted") {
      enumerateDevices();
    }
  }, [permission, enumerateDevices]);

  // Start/swap preview stream when device changes (without recording)
  useEffect(() => {
    if (!selectedDeviceId || recording) return;

    let cancelled = false;

    (async () => {
      // Stop previous preview
      previewStreamRef.current?.getTracks().forEach((t) => t.stop());
      setPreviewing(false);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedDeviceId } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        previewStreamRef.current = stream;
        setPreviewing(true);
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
        }
      } catch {
        // Device unavailable — ignore, user can pick another
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedDeviceId, recording]);

  // Attach hook's preview stream during recording
  useEffect(() => {
    if (recording && previewRef.current && recorder.previewStream) {
      previewRef.current.srcObject = recorder.previewStream;
    }
  }, [recording, recorder.previewStream]);

  // Cleanup preview stream on unmount
  useEffect(() => {
    return () => {
      previewStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermission("granted");
    } catch {
      setPermission("denied");
    }
  };

  const startRecording = () => {
    // Stop preview stream so the hook can acquire the same device
    previewStreamRef.current?.getTracks().forEach((t) => t.stop());
    previewStreamRef.current = null;
    setPreviewing(false);
    setRecording(true);
    recorder.startRecording();
  };

  const stopRecording = () => {
    recorder.stopRecording();
  };

  const cancel = () => {
    previewStreamRef.current?.getTracks().forEach((t) => t.stop());
    previewStreamRef.current = null;
    recorder.stopRecording();
    onCancel();
  };

  // Permission: prompt
  if (permission === "prompt") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <Camera className="h-16 w-16 text-muted-foreground" />
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-muted-foreground max-w-xs">
            yava needs access to your camera to record video. Your browser will
            ask for permission.
          </p>
        </div>
        <Button onClick={requestPermission}>Allow Camera Access</Button>
        <Button variant="ghost" size="sm" onClick={cancel}>
          Cancel
        </Button>
      </div>
    );
  }

  // Permission: denied
  if (permission === "denied") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium">Camera access denied</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            To record video, allow camera access in your browser settings, then
            reload the page.
          </p>
        </div>
        <Button variant="secondary" onClick={cancel}>
          Close
        </Button>
      </div>
    );
  }

  // Permission: granted — show device selector + preview + controls
  return (
    <div className="flex flex-col gap-3">
      {videoDevices.length > 1 && (
        <Select
          value={selectedDeviceId}
          onValueChange={setSelectedDeviceId}
          disabled={recording}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select camera" />
          </SelectTrigger>
          <SelectContent>
            {videoDevices.map((d) => (
              <SelectItem key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera (${d.deviceId.substring(0, 7)})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex flex-col gap-3 justify-center relative">
        <Video
          className={cn(
            "absolute top-[50%] left-[50%] transform -translate-x-[50%] -translate-y-[80%] h-20 w-20 text-primary",
            (recording || previewing) && "hidden",
          )}
        />

        <video
          ref={previewRef}
          className="w-full h-full shadow rounded"
          autoPlay
          playsInline
          muted
        />

        {!recording && (
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={cancel}>
              Cancel
            </Button>
            <Button onClick={startRecording} disabled={!selectedDeviceId}>
              Start Recording
            </Button>
          </div>
        )}

        {recording && (
          <Button variant="destructive" onClick={stopRecording}>
            Stop Recording
          </Button>
        )}
      </div>
    </div>
  );
};

export default CameraRecorder;
