import "@/index.css";
import { beforeMount } from "@playwright/experimental-ct-react/hooks";
import { useAppStore } from "@/store";

export type HooksConfig = {
  storeState?: Record<string, unknown>;
};

beforeMount<HooksConfig>(async ({ hooksConfig }) => {
  if (hooksConfig?.storeState) {
    useAppStore.setState(hooksConfig.storeState);
  }
});
