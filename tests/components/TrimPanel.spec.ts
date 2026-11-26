import { test, expect } from "@playwright/test";
import type { Default } from "@/components/panels/TrimPanel.story.tsx";

const TRIM = "components/panels/TrimPanel/Default";

test("renders start and end fields", async ({ mount }) => {
  const component = await mount(TRIM);

  await expect(component.getByText("Start")).toBeVisible();
  await expect(component.getByText("End")).toBeVisible();
});

test("displays formatted cursor times", async ({ mount }) => {
  const component = await mount<typeof Default>(TRIM, { trim: [5, 30] });

  const inputs = component.locator("input");
  await expect(inputs.first()).toHaveValue("00:05:000");
  await expect(inputs.nth(1)).toHaveValue("00:30:000");
});

test("does not show Reset button when no trim applied", async ({ mount }) => {
  const component = await mount(TRIM);

  await expect(
    component.getByRole("button", { name: "Reset" }),
  ).not.toBeVisible();
});

test("shows Reset button when trim is applied", async ({ mount }) => {
  const component = await mount<typeof Default>(TRIM, { trim: [5, 30] });

  await expect(component.getByRole("button", { name: "Reset" })).toBeVisible();
});

test("Reset button restores inputs to full duration", async ({ mount }) => {
  const component = await mount<typeof Default>(TRIM, { trim: [5, 30] });

  await component.getByRole("button", { name: "Reset" }).click();

  const inputs = component.locator("input");
  await expect(inputs.first()).toHaveValue("00:00:000");
  await expect(inputs.nth(1)).toHaveValue("01:00:000");
});

test("updates start input on blur", async ({ mount }) => {
  const component = await mount(TRIM);

  const startInput = component.locator("input").first();
  await startInput.fill("00:10:000");
  await startInput.blur();

  await expect(startInput).toHaveValue("00:10:000");
});

test("clamps start input to not exceed end - MIN_SLICE_DISTANCE", async ({
  mount,
}) => {
  const component = await mount<typeof Default>(TRIM, { trim: [0, 20] });

  const startInput = component.locator("input").first();
  await startInput.fill("00:25:000");
  await startInput.blur();

  await expect(startInput).toHaveValue("00:19:500");
});
