import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button.tsx";
import YavaLogo from "@/components/YavaLogo";
import { useAppStore } from "@/store.tsx";
import { PropsWithChildren } from "react";

/**
 * Without this a render error unmounts the whole tree and leaves an empty page
 * with no way back, not even the header's Start Over.
 */
const AppErrorBoundary = ({ children }: PropsWithChildren) => (
  <Sentry.ErrorBoundary
    fallback={({ resetError }) => (
      <div className="flex h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <YavaLogo className="h-10 w-10 text-primary" />
        <p className="max-w-sm text-sm text-muted-foreground">
          Something went wrong and the editor stopped. Nothing left your device,
          so there is nothing to clean up: start over and try again.
        </p>
        <Button
          onClick={() => {
            useAppStore.getState().reset();
            resetError();
          }}
        >
          Start Over
        </Button>
      </div>
    )}
  >
    {children}
  </Sentry.ErrorBoundary>
);

export default AppErrorBoundary;
