import { useId } from "react";
import { useAppStore } from "@/store.tsx";
import { useShallow } from "zustand/react/shallow";
import { cropToSource, EMPTY_CROP, hasArea } from "@/lib/crop.ts";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";

const CropPanel = () => {
  const id = useId();
  const { video, cropRectangle, setCropRectangle } = useAppStore(
    useShallow((s) => ({
      video: s.video,
      cropRectangle: s.cropRectangle,
      setCropRectangle: s.setCropRectangle,
    })),
  );

  if (!video) return null;

  const hasCrop = hasArea(cropRectangle);

  const inSource = cropToSource(
    cropRectangle,
    video.videoWidth,
    video.videoHeight,
  );

  const updateCrop = (field: "x" | "y" | "w" | "h", pixelValue: number) => {
    const base =
      cropRectangle.vw && cropRectangle.vh
        ? cropRectangle
        : {
            ...cropRectangle,
            vw: video.videoWidth,
            vh: video.videoHeight,
          };
    const scale =
      field === "x" || field === "w"
        ? video.videoWidth / base.vw
        : video.videoHeight / base.vh;
    setCropRectangle({ ...base, [field]: Math.max(0, pixelValue) / scale });
  };

  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="grid grid-cols-2 gap-2">
        {(["x", "y", "w", "h"] as const).map((field) => (
          <div key={field} className="flex flex-col gap-1">
            <label
              htmlFor={`${id}-${field}`}
              className="text-xs text-muted-foreground"
            >
              {field === "w" ? "Width" : field === "h" ? "Height" : field}
            </label>
            <Input
              id={`${id}-${field}`}
              type="number"
              className="font-mono text-sm h-8 bg-background"
              value={Math.round(inSource[field])}
              min={0}
              onChange={(e) => updateCrop(field, +e.currentTarget.value)}
            />
          </div>
        ))}
      </div>

      {hasCrop && (
        <Button
          variant="link"
          className="text-xs h-min p-0 text-primary self-end"
          onClick={() => setCropRectangle(EMPTY_CROP)}
        >
          Reset
        </Button>
      )}
    </div>
  );
};

export default CropPanel;
