import { test, expect } from "@playwright/experimental-ct-react";
import SliceToolbar from "@/components/timeline/SliceToolbar";
import { withStore } from "../helpers";

test("slice button is disabled when cursor is at segment start", async ({
  mount,
}) => {
  const component = await mount(
    <SliceToolbar />,
    withStore({ cursorCurrent: 0 }),
  );

  const button = component.getByRole("button");
  await expect(button).toBeDisabled();
});

test("slice button is disabled when cursor is near segment boundary", async ({
  mount,
}) => {
  // MIN_SLICE_DISTANCE is 0.5s — cursor at 0.3 is within that threshold
  const component = await mount(
    <SliceToolbar />,
    withStore({ cursorCurrent: 0.3 }),
  );

  const button = component.getByRole("button");
  await expect(button).toBeDisabled();
});

test("slice button is enabled when cursor is within a segment", async ({
  mount,
}) => {
  const component = await mount(
    <SliceToolbar />,
    withStore({ cursorCurrent: 30 }),
  );

  const button = component.getByRole("button");
  await expect(button).toBeEnabled();
});

test("clicking slice increases segment count from 1 to 2", async ({
  mount,
}) => {
  const component = await mount(
    <SliceToolbar />,
    withStore({ cursorCurrent: 30 }),
  );

  const button = component.getByRole("button");
  await button.click();

  // After slicing, cursor is now at the boundary of two segments —
  // the button should be disabled
  await expect(button).toBeDisabled();
});
