import { test, expect } from "@playwright/experimental-ct-react";
import type { HooksConfig } from "../playwright/index";
import TrimPanel from "@/components/panels/TrimPanel";

const defaultStore = {
  video: { duration: 60 } as HTMLVideoElement,
  cursorStart: 0,
  cursorEnd: 60,
  cursorCurrent: 0,
};

function withStore(overrides: Record<string, unknown> = {}): {
  hooksConfig: HooksConfig;
} {
  return {
    hooksConfig: {
      storeState: { ...defaultStore, ...overrides },
    },
  };
}

test("renders start, end, and duration fields", async ({ mount }) => {
  const component = await mount(<TrimPanel />, withStore());

  await expect(component.getByText("Start")).toBeVisible();
  await expect(component.getByText("End")).toBeVisible();
  await expect(component.getByText("Duration")).toBeVisible();
});

test("displays formatted cursor times", async ({ mount }) => {
  const component = await mount(
    <TrimPanel />,
    withStore({ cursorStart: 5, cursorEnd: 30 }),
  );

  const inputs = component.locator("input");
  await expect(inputs.first()).toHaveValue("00:00:05:000");
  await expect(inputs.nth(1)).toHaveValue("00:00:30:000");
});

test("displays computed duration", async ({ mount }) => {
  const component = await mount(
    <TrimPanel />,
    withStore({ cursorStart: 10, cursorEnd: 40 }),
  );

  await expect(component.getByText("00:00:30:000")).toBeVisible();
});

test("does not show Reset button when no trim applied", async ({ mount }) => {
  const component = await mount(<TrimPanel />, withStore());

  await expect(
    component.getByRole("button", { name: "Reset" }),
  ).not.toBeVisible();
});

test("shows Reset button when trim is applied", async ({ mount }) => {
  const component = await mount(
    <TrimPanel />,
    withStore({ cursorStart: 5, cursorEnd: 30 }),
  );

  await expect(
    component.getByRole("button", { name: "Reset" }),
  ).toBeVisible();
});

test("Reset button restores inputs to full duration", async ({ mount }) => {
  const component = await mount(
    <TrimPanel />,
    withStore({ cursorStart: 5, cursorEnd: 30 }),
  );

  await component.getByRole("button", { name: "Reset" }).click();

  const inputs = component.locator("input");
  await expect(inputs.first()).toHaveValue("00:00:00:000");
  await expect(inputs.nth(1)).toHaveValue("00:01:00:000");
});

test("updates start input on blur", async ({ mount }) => {
  const component = await mount(<TrimPanel />, withStore());

  const startInput = component.locator("input").first();
  await startInput.fill("00:00:10:000");
  await startInput.blur();

  await expect(startInput).toHaveValue("00:00:10:000");
});

test("clamps start input to not exceed end - 1", async ({ mount }) => {
  const component = await mount(
    <TrimPanel />,
    withStore({ cursorEnd: 20 }),
  );

  const startInput = component.locator("input").first();
  await startInput.fill("00:00:25:000");
  await startInput.blur();

  await expect(startInput).toHaveValue("00:00:19:000");
});
