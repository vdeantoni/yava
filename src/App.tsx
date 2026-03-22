import VideoTimeline from "@/components/timeline/VideoTimeline.tsx";
import { useAppStore } from "@/store.tsx";
import VideoPlayer from "@/components/player/VideoPlayer.tsx";
import { Clapperboard, Github, Upload } from "lucide-react";
import NewVideo from "./components/NewVideo";
import { Button } from "@/components/ui/button.tsx";
import { Analytics } from "@vercel/analytics/react";
import TrimPanel from "@/components/panels/TrimPanel.tsx";
import ExportPanel from "@/components/panels/ExportPanel.tsx";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.tsx";

const triggerClass =
  "px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:no-underline";

function App() {
  const { file, reset, video } = useAppStore();

  return (
    <>
      <div className="flex h-[100svh] flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-11 items-center justify-between gap-4 border-b border-border bg-card px-3 shrink-0">
          <nav className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold tracking-tight">yava</h1>
          </nav>
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
              {/* Video Player */}
              <div className="flex flex-1 flex-col min-w-0 min-h-0">
                <VideoPlayer />
              </div>

              {/* Sidebar — Trim + Export */}
              {video && (
                <aside className="lg:w-[260px] shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card overflow-y-auto">
                  <Accordion
                    type="multiple"
                    defaultValue={["trim", "export"]}
                    className="grid grid-cols-2 lg:block"
                  >
                    <AccordionItem value="trim" className="border-r lg:border-r-0">
                      <AccordionTrigger className={triggerClass}>
                        Trim
                      </AccordionTrigger>
                      <AccordionContent>
                        <TrimPanel />
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="export">
                      <AccordionTrigger className={triggerClass}>
                        Crop & Export
                      </AccordionTrigger>
                      <AccordionContent>
                        <ExportPanel />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </aside>
              )}
            </div>

            {/* Timeline — full width */}
            {video && <VideoTimeline />}
          </main>
        )}
      </div>
      <Analytics />
    </>
  );
}

export default App;
