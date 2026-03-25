import VideoTimeline from "@/components/timeline/VideoTimeline.tsx";
import SliceToolbar from "@/components/timeline/SliceToolbar.tsx";
import { useAppStore } from "@/store.tsx";
import VideoPlayer from "@/components/player/VideoPlayer.tsx";
import { Github, Upload } from "lucide-react";
import YavaLogo from "@/components/YavaLogo";
import NewVideo from "./components/NewVideo";
import { Button } from "@/components/ui/button.tsx";
import { Analytics } from "@vercel/analytics/react";
import TrimPanel from "@/components/panels/TrimPanel.tsx";
import CropPanel from "@/components/panels/CropPanel.tsx";
import ExportPanel from "@/components/panels/ExportPanel.tsx";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.tsx";
import { useEffect } from "react";

const triggerClass =
  "px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:no-underline";

function App() {
  const { file, reset, video } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        // Don't intercept when typing in an input
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;

        const { selectedSegmentId, segments, deleteSegment } =
          useAppStore.getState();
        if (selectedSegmentId && segments.length > 1) {
          e.preventDefault();
          deleteSegment(selectedSegmentId);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div className="flex h-svh flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-11 items-center justify-between gap-4 border-b border-border bg-card px-3 shrink-0">
          <YavaLogo className="h-7 w-7 text-primary" />
          <div className="flex items-center gap-2">
            {file && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => reset()}
              >
                <Upload className="h-3.5 w-3.5 mr-1" />
                New File
              </Button>
            )}
            <a
              href="https://github.com/vdeantoni/yava"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-4 h-4" />
            </a>
          </div>
        </header>

        {/* Main content */}
        {!file && (
          <main className="flex flex-1 overflow-auto">
            <NewVideo />
          </main>
        )}

        {file && (
          <main className="flex flex-col min-h-0">
            <div className="flex flex-1 min-h-[400px] flex-col lg:flex-row">
              {/* Left sidebar — Trim & Crop (desktop only) */}
              {video && (
                <>
                  <aside className="hidden lg:block lg:w-[200px] shrink-0 border-r border-border bg-card overflow-y-auto">
                    <Accordion type="multiple" defaultValue={["trim", "crop"]}>
                      <AccordionItem value="trim">
                        <AccordionTrigger className={triggerClass}>
                          Trim
                        </AccordionTrigger>
                        <AccordionContent>
                          <TrimPanel />
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="crop">
                        <AccordionTrigger className={triggerClass}>
                          Crop
                        </AccordionTrigger>
                        <AccordionContent>
                          <CropPanel />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </aside>

                  {/* Video Player */}
                  <div className="flex flex-1 flex-col min-w-0 min-h-0">
                    <VideoPlayer />
                  </div>

                  {/* Right sidebar — Export (desktop only) */}
                  <aside className="hidden lg:block lg:w-[200px] shrink-0 border-l border-border bg-card overflow-y-auto">
                    <Accordion type="multiple" defaultValue={["export"]}>
                      <AccordionItem value="export">
                        <AccordionTrigger className={triggerClass}>
                          Export
                        </AccordionTrigger>
                        <AccordionContent>
                          <ExportPanel />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </aside>

                  {/* Mobile panels — side-by-side accordion */}
                  <aside className="lg:hidden border-t border-border bg-card overflow-y-auto">
                    <Accordion
                      type="multiple"
                      defaultValue={["trim", "crop", "export"]}
                      className="grid grid-cols-2"
                    >
                      <div className="border-r border-border">
                        <AccordionItem value="trim">
                          <AccordionTrigger className={triggerClass}>
                            Trim
                          </AccordionTrigger>
                          <AccordionContent>
                            <TrimPanel />
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="crop">
                          <AccordionTrigger className={triggerClass}>
                            Crop
                          </AccordionTrigger>
                          <AccordionContent>
                            <CropPanel />
                          </AccordionContent>
                        </AccordionItem>
                      </div>
                      <AccordionItem value="export">
                        <AccordionTrigger className={triggerClass}>
                          Export
                        </AccordionTrigger>
                        <AccordionContent>
                          <ExportPanel />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </aside>
                </>
              )}

              {/* Video Player (shown before video metadata loads) */}
              {!video && (
                <div className="flex flex-1 flex-col min-w-0 min-h-0">
                  <VideoPlayer />
                </div>
              )}
            </div>

            {/* Slice toolbar + Timeline — full width */}
            {video && <SliceToolbar />}
            {video && <VideoTimeline />}
          </main>
        )}
      </div>
      <Analytics />
    </>
  );
}

export default App;
