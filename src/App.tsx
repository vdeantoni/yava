import VideoTimeline from "@/components/VideoTimeline.tsx";
import { useAppStore } from "@/store.tsx";
import VideoPlayer from "@/components/VideoPlayer.tsx";
import { Clapperboard, Download, Upload } from "lucide-react";
import VideoExportDialog from "@/components/VideoExportDialog.tsx";
import FileUpload from "./components/FileUpload";
import { Button } from "@/components/ui/button.tsx";
import { Analytics } from "@vercel/analytics/react";
import MadeBy from "@/components/MadeBy.tsx";

function App() {
  const { file, reset, video } = useAppStore();

  return (
    <>
      <div className="flex min-h-screen w-full flex-col">
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
                New video file
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
        <main className="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col bg-muted/40 p-2 md:p-4">
          <div className="grid max-w-8xl w-full max-w-8xl items-start grid-cols-[1fr] gap-6">
            {!file && <FileUpload />}

            {file && (
              <>
                <VideoPlayer />
                {video && <VideoTimeline />}
              </>
            )}
          </div>
        </main>
      </div>
      <MadeBy />
      <Analytics />
    </>
  );
}

export default App;
