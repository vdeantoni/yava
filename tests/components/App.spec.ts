import { test, expect } from "@playwright/test";

test("shows upload screen when no file is loaded", async ({ mount }) => {
  const component = await mount("App/Empty");

  await expect(component.getByText("Ready?")).toBeVisible();
  await expect(
    component.getByRole("button", { name: "Start Over" }),
  ).not.toBeVisible();
});

test("shows editor when file is present", async ({ mount }) => {
  const component = await mount("App/Editing");

  await expect(component.getByText("Ready?")).not.toBeVisible();
  await expect(
    component.getByRole("button", { name: "Start Over" }),
  ).toBeVisible();
});

test("Start Over button resets to upload screen", async ({ mount }) => {
  const component = await mount("App/Editing");

  await component.getByRole("button", { name: "Start Over" }).click();

  await expect(component.getByText("Ready?")).toBeVisible();
  await expect(
    component.getByRole("button", { name: "Start Over" }),
  ).not.toBeVisible();
});
