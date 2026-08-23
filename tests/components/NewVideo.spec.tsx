import { test, expect } from "@playwright/experimental-ct-react";
import NewVideo from "@/components/NewVideo";

test("renders heading and description text", async ({ mount }) => {
  const component = await mount(<NewVideo />);

  await expect(component.getByText("Ready?")).toBeVisible();
  await expect(component.getByText("no files leave your device")).toBeVisible();
});

test("shows action buttons", async ({ mount }) => {
  const component = await mount(<NewVideo />);

  await expect(component.getByText("Browse Files")).toBeVisible();
  await expect(component.getByRole("button", { name: "URL" })).toBeVisible();
  await expect(component.getByRole("button", { name: "Record" })).toBeVisible();
  await expect(component.getByRole("button", { name: "Screen" })).toBeVisible();
});

test("clicking URL button shows the URL input field", async ({ mount }) => {
  const component = await mount(<NewVideo />);

  // No URL input initially
  await expect(component.locator('input[type="url"]')).not.toBeVisible();

  // Click URL button
  await component.getByText("URL").click();

  // URL input should appear
  await expect(component.locator('input[type="url"]')).toBeVisible();
});

test("pressing Escape in URL input returns to default view", async ({
  mount,
}) => {
  const component = await mount(<NewVideo />);

  await component.getByText("URL").click();
  const urlInput = component.locator('input[type="url"]');
  await expect(urlInput).toBeVisible();

  await urlInput.press("Escape");

  await expect(urlInput).not.toBeVisible();
});

test("shows 'Try a demo video' link", async ({ mount }) => {
  const component = await mount(<NewVideo />);

  await expect(component.getByText("Try a demo video")).toBeVisible();
});

test("shows feature badges", async ({ mount }) => {
  const component = await mount(<NewVideo />);

  await expect(component.getByText("FFmpeg")).toBeVisible();
  await expect(component.getByText("No uploads")).toBeVisible();
  await expect(component.getByText("WASM")).toBeVisible();
});

test("shows supported format labels", async ({ mount }) => {
  const component = await mount(<NewVideo />);

  for (const fmt of ["MP4", "MOV", "WEBM", "GIF"]) {
    await expect(component.getByText(fmt)).toBeVisible();
  }
});
