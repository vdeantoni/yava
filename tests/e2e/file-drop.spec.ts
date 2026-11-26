import { readFileSync } from "node:fs";
import { test } from "@playwright/test";
import { FIXTURE, waitForEditor } from "./helpers";

test("a dropped file the browser left typeless opens by its extension", async ({
  page,
}) => {
  await page.goto("/");

  const dataTransfer = await page.evaluateHandle((base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "clip.mov"));
    return transfer;
  }, readFileSync(FIXTURE).toString("base64"));

  await page
    .getByRole("heading", { name: "yava" })
    .dispatchEvent("drop", { dataTransfer });

  await waitForEditor(page);
});
