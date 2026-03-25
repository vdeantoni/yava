import { test, expect } from "@playwright/experimental-ct-react";
import type { HooksConfig } from "../playwright/index";
import TrimPanel from "@/components/panels/TrimPanel";

const defaultStore = {
  video: { duration: 60 } as HTMLVideoElement,
  cursorStart: 0,
  cursorEnd: 60,
  cursorCurrent: 0,
  segments: [{ id: "s0", sourceStart: 0, sourceEnd: 60 }],
  nextSegmentId: 1,
};

function withStore(overrides: Record<string, unknown> = {}): {
  hooksConfig: HooksConfig;
} {
  const cursorStart =
    (overrides.cursorStart as number | undefined) ?? defaultStore.cursorStart;
  const cursorEnd =
    (overrides.cursorEnd as number | undefined) ?? defaultStore.cursorEnd;
  return {
    hooksConfig: {
      storeState: {
        ...defaultStore,
        ...overrides,
        segments: [{ id: "s0", sourceStart: cursorStart, sourceEnd: cursorEnd }],
      },
    },
  };
}

test("renders start and end fields", async ({ mount }) => {
  const component = await mount(<TrimPanel />, withStore());

  await expect(component.getByText("Start")).toBeVisible();
  await expect(component.getByText("End")).toBeVisible();
});

test("displays formatted cursor times", async ({ mount }) => {
  const component = await mount(
    <TrimPanel />,
    withStore({ cursorStart: 5, cursorEnd: 30 }),
  );

  const inputs = component.locator("input");
  await expect(inputs.first()).toHaveValue("00:05:000");
  await expect(inputs.nth(1)).toHaveValue("00:30:000");
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
  await expect(inputs.first()).toHaveValue("00:00:000");
  await expect(inputs.nth(1)).toHaveValue("01:00:000");
});

test("updates start input on blur", async ({ mount }) => {
  const component = await mount(<TrimPanel />, withStore());

  const startInput = component.locator("input").first();
  await startInput.fill("00:10:000");
  await startInput.blur();

  await expect(startInput).toHaveValue("00:10:000");
});

test("clamps start input to not exceed end - MIN_SLICE_DISTANCE", async ({
  mount,
}) => {
  const component = await mount(
    <TrimPanel />,
    withStore({ cursorEnd: 20 }),
  );

  const startInput = component.locator("input").first();
  await startInput.fill("00:25:000");
  await startInput.blur();

  await expect(startInput).toHaveValue("00:19:500");
});
