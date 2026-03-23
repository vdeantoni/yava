import { useAppStore } from "@/store.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";

const CropPanel = () => {
  const { video, cropRectangle, setCropRectangle } = useAppStore();

  if (!video) return null;

  const hasCrop = cropRectangle.w > 0 && cropRectangle.h > 0;

  const px = cropRectangle.vw ? video.videoWidth / cropRectangle.vw : 1;
  const py = cropRectangle.vh ? video.videoHeight / cropRectangle.vh : 1;

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
            <label className="text-xs text-muted-foreground">
              {field === "w" ? "Width" : field === "h" ? "Height" : field}
            </label>
            <Input
              type="number"
              className="font-mono text-sm h-8 bg-background"
              value={Math.round(
                cropRectangle[field] *
                  (field === "x" || field === "w" ? px : py),
              )}
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
          onClick={() =>
            setCropRectangle({ x: 0, y: 0, w: 0, h: 0, vw: 0, vh: 0 })
          }
        >
          Reset
        </Button>
      )}
    </div>
  );
};

export default CropPanel;
