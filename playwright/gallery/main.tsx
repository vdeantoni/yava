import { StrictMode, type ComponentType } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import "@/index.css";

type StoryModule = Record<string, ComponentType<Record<string, unknown>>>;

// Vite resolves the glob relative to this file at build time, so it has to stay inline.
const stories = import.meta.glob<StoryModule>("../../src/**/*.story.tsx");

/** `../../src/components/NewVideo.story.tsx` is `components/NewVideo`. */
const storyPath = (file: string) =>
  file.replace(/^(\.\.\/)+src\//, "").replace(/\.story\.tsx$/, "");

async function resolve(storyId: string) {
  const sep = storyId.lastIndexOf("/");
  const path = storyId.slice(0, sep);
  const name = storyId.slice(sep + 1);
  const file = Object.keys(stories).find(
    (f) => storyPath(f) === path || storyPath(f).endsWith("/" + path),
  );
  const mod = file ? await stories[file]() : undefined;
  return mod?.[name];
}

const rootElement = document.getElementById("root")!;
let root: Root | undefined;

declare global {
  interface Window {
    mount(params: {
      story: string;
      props?: Record<string, unknown>;
    }): Promise<void>;
    unmount(): Promise<void>;
  }
}

window.mount = async ({ story, props }) => {
  const Story = await resolve(story);
  if (!Story) throw new Error(`Unknown story: ${story}`);

  // One root for every call, so update() reconciles instead of remounting.
  root ??= createRoot(rootElement);
  // flushSync, so a story that throws while rendering rejects the mount.
  flushSync(() =>
    root!.render(
      <StrictMode>
        <Story {...props} />
      </StrictMode>,
    ),
  );
};

window.unmount = async () => {
  root?.unmount();
  root = undefined;
};
