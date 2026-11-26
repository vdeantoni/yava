import VideoTimeline from "@/components/timeline/VideoTimeline.tsx";
import TimelineToolbar from "@/components/timeline/TimelineToolbar.tsx";
import { useAppStore } from "@/store.tsx";
import { useShallow } from "zustand/react/shallow";
import VideoPlayer from "@/components/player/VideoPlayer.tsx";
import { RotateCcw } from "lucide-react";
import YavaLogo from "@/components/YavaLogo";
import NewVideo from "./components/NewVideo";
import "@/lib/url-state"; // activate store → URL sync
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
  const { file, reset, video } = useAppStore(
    useShallow((s) => ({
      file: s.file,
      reset: s.reset,
      video: s.video,
    })),
  );

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
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Start Over
              </Button>
            )}
            <a
              href="https://github.com/vdeantoni/yava"
              aria-label="This project on GitHub"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
                className="w-4 h-4"
              >
                <path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656" />
              </svg>
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
          <main className="flex flex-1 flex-col min-h-0 overflow-auto">
            <div className="flex flex-col lg:flex-row">
              {/* Left sidebar — Trim & Crop (desktop only) */}
              {video && (
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
              )}

              {/* Video Player */}
              <div className="flex flex-col lg:flex-1 min-w-0">
                <VideoPlayer />
              </div>

              {/* Right sidebar — Export (desktop only) */}
              {video && (
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
              )}
            </div>

            {/* Mobile panels — below video, outside the flex-1 container */}
            {video && (
              <aside className="lg:hidden shrink-0 border-t border-border bg-card overflow-y-auto">
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
            )}

            {/* Toolbar + Timeline — full width */}
            {video && <TimelineToolbar />}
            {video && <VideoTimeline />}
          </main>
        )}
      </div>
      <Analytics />
    </>
  );
}

export default App;
