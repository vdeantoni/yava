import VideoTimeline from "@/components/timeline/VideoTimeline.tsx";
import { useAppStore } from "@/store.tsx";
import VideoPlayer from "@/components/player/VideoPlayer.tsx";
import { Clapperboard, Github, Plus, Upload } from "lucide-react";
import NewVideo from "./components/NewVideo";
import { Button } from "@/components/ui/button.tsx";
import { Analytics } from "@vercel/analytics/react";
import * as Sentry from "@sentry/react";
import TrimPanel from "@/components/panels/TrimPanel.tsx";
import ExportPanel from "@/components/panels/ExportPanel.tsx";

Sentry.init({
  enabled: !import.meta.env.DEV,
  dsn: "https://7ecb9144de14ea899c8af041bdb68045@o428318.ingest.us.sentry.io/4507867732377600",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

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
          <main className="flex flex-1 flex-col min-h-0">
            {/* Three-column layout on lg+, stacked on mobile */}
            <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
              {/* Left sidebar — Trim (sidebar on lg+, inline on mobile) */}
              {video && (
                <aside className="lg:w-[200px] shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-card overflow-y-auto order-2 lg:order-1">
                  <TrimPanel />
                </aside>
              )}

              {/* Center — Video Player */}
              <div className="flex flex-1 flex-col min-w-0 min-h-0 order-1 lg:order-2">
                <VideoPlayer />
              </div>

              {/* Right sidebar — Export (sidebar on lg+, inline on mobile) */}
              {video && (
                <aside className="lg:w-[240px] shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card overflow-y-auto order-3">
                  <ExportPanel />
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
