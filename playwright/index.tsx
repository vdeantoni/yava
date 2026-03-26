import "@/index.css";
import { beforeMount } from "@playwright/experimental-ct-react/hooks";
import { useAppStore } from "@/store";

export type HooksConfig = {
  storeState?: Record<string, unknown>;
};

beforeMount<HooksConfig>(async ({ hooksConfig }) => {
  if (hooksConfig?.storeState) {
    const state = { ...hooksConfig.storeState };
    // Blob can't be serialized from Node.js → browser; create it here
    if (state.file) {
      state.file = new Blob(["fake"], { type: "video/mp4" });
    }
    useAppStore.setState(state);
  }
});
