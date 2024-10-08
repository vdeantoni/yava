import VideoTimeline from "@/components/timeline/VideoTimeline.tsx";
import { useAppStore } from "@/store.tsx";
import VideoPlayer from "@/components/player/VideoPlayer.tsx";
import {
  Clapperboard,
  Download,
  Github,
  TriangleAlert,
  Video,
} from "lucide-react";
import VideoExportDialog from "@/components/export/VideoExportDialog.tsx";
import NewVideo from "./components/NewVideo";
import { Button } from "@/components/ui/button.tsx";
import { Analytics } from "@vercel/analytics/react";
import MadeBy from "@/components/MadeBy.tsx";
import { isMobile } from "@/lib/utils.ts";
import * as Sentry from "@sentry/react";
import VideoExportOptions from "@/components/export/VideoExportOptions";

Sentry.init({
  enabled: process.env.NODE_ENV !== "development",
  dsn: "https://7ecb9144de14ea899c8af041bdb68045@o428318.ingest.us.sentry.io/4507867732377600",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
});

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
                <Video width={18} className="mr-2" />
                New video
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
        <main className="flex flex-1 flex-col p-2 md:p-4 max-w-8xl">
          {!file && <NewVideo />}

          {file && (
            <div className="flex flex-col gap-6">
              <VideoPlayer />
              {video && <VideoTimeline />}
              {video && <VideoExportOptions />}
            </div>
          )}
        </main>
        <footer className="flex items-end justify-between px-3 pb-4 duration opacity-75 hover:opacity-100">
          <a
            href="https://github.com/vdeantoni/yava"
            className="flex items-center gap-1"
          >
            <Github className="w-6" />
            <span className="text-xs">vdeantoni/yava</span>
          </a>
          <MadeBy />
        </footer>
      </div>
      <Analytics />
    </>
  );
}

export default App;
