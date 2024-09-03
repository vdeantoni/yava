import { useAppStore } from "@/store.tsx";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils.ts";

const FileUpload = () => {
  const { setFile } = useAppStore();

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
    <div className="relative h-full flex flex-col items-center">
      <div className="flex flex-col items-center mt-4 sm:mt-10">
        <h1 className="flex gap-4 items-center text-8xl">
          <Clapperboard width={128} height={128} />
          yava
        </h1>
        <h2 className="self-end text-sm -mt-6 mr-0.5">yet another video app</h2>
      </div>
      <div className="mt-8 sm:mt-16 mb-6 sm:mb-10 text-center">
        Trim, cut, crop and export video files{" "}
        <span className="underline">directly from your browser</span>.{" "}
        Everything is processed locally,{" "}
        <span className="font-bold">nothing leaves your device</span>!
      </div>

      <div
        className={cn(
          "w-full sm:w-[80vw] md:w-[70vw] lg:w-[60vw] xl:w-[50vw] h-[40vh] sm:h-[50vh] bg-secondary border-2 border-dashed rounded flex flex-col items-center justify-center",
          isDragActive && "border-primary",
        )}
        {...getRootProps()}
      >
        <Input {...getInputProps()} />
        <p className="text-sm">
          Drag and drop a video file here, or
          <Button variant="link" className="text-sm p-1" onClick={open}>
            select
          </Button>
          one.
        </p>
      </div>
    </div>
  );
};

export default FileUpload;
