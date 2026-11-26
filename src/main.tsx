import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "@/App.tsx";
import AppErrorBoundary from "@/components/AppErrorBoundary.tsx";
import "@/index.css";

const PII_KEYS = { deny: ["forwarded", "-ip", "remote-", "via", "-user"] };

Sentry.init({
  enabled: !import.meta.env.DEV,
  dsn: "https://7ecb9144de14ea899c8af041bdb68045@o428318.ingest.us.sentry.io/4507867732377600",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Sentry collects any category left out of here, cookies and bodies included.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: PII_KEYS,
    httpBodies: [],
    urlQueryParams: PII_KEYS,
  },
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
