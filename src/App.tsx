import VideoTimeline from "@/components/timeline/VideoTimeline.tsx";
import { useAppStore } from "@/store.tsx";
import VideoPlayer from "@/components/player/VideoPlayer.tsx";
import { Clapperboard, Download, TriangleAlert, Upload } from "lucide-react";
import VideoExportDialog from "@/components/export/VideoExportDialog.tsx";
import FileUpload from "./components/FileUpload";
import { Button } from "@/components/ui/button.tsx";
import { Analytics } from "@vercel/analytics/react";
import MadeBy from "@/components/MadeBy.tsx";
import { isMobile } from "@/lib/utils.ts";

function App() {
  const { file, reset, video } = useAppStore();

  return (
    <>
      <div className="flex min-h-[100svh] flex-col">
        {isMobile && (
          <div className="flex flex-row items-center justify-center gap-1 text-xs bg-amber-200 text-nowrap">
            <TriangleAlert width={14} />
            Mobile isn't fully supported yet, some files might crash the app
          </div>
        )}
        {file && (
          <header className="flex h-12 items-center justify-between gap-4 border-b bg-background px-2 md:px-4">
            <nav className="flex flex-row gap-2 text-lg font-medium items-center">
              <span className="flex items-center gap-2 text-lg font-semibold md:text-base">
                <Clapperboard className="h-6 w-6" />
                <span className="sr-only">yava</span>
              </span>
              <h1 className="text-xl font-semibold text-nowrap cursor-default">
                yava
              </h1>
            </nav>
            <div className="flex gap-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  reset();
                }}
              >
                <Upload width={18} className="mr-2" />
                New file
              </Button>
              {video && (
                <VideoExportDialog>
                  <Button variant="default" size="sm">
                    <Download width={18} className="mr-2" />
                    Export
                  </Button>
                </VideoExportDialog>
              )}
            </div>
          </header>
        )}
        <main className="flex flex-1 flex-col p-2 md:p-4">
          <div className="grid w-full max-w-8xl items-start grid-cols-[1fr] gap-6">
            {!file && <FileUpload />}

            {file && (
              <>
                <VideoPlayer />
                {video && <VideoTimeline />}
              </>
            )}
          </div>
        </main>
        <footer className="flex items-center justify-end pr-3 pb-4">
          <MadeBy />
        </footer>
      </div>
      <Analytics />
    </>
  );
}

export default App;
