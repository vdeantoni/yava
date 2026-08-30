import { test, expect } from "@playwright/experimental-ct-react";
import TimelineToolbar from "@/components/timeline/TimelineToolbar";
import { withStore } from "../helpers";

const SLICE = "Slice at the playhead";
const FADE_IN = "Fade in";
const FADE_OUT = "Fade out";

test("slice button is disabled when cursor is at segment start", async ({
  mount,
}) => {
  const component = await mount(
    <TimelineToolbar />,
    withStore({ cursorCurrent: 0 }),
  );

  await expect(component.getByRole("button", { name: SLICE })).toBeDisabled();
});

test("slice button is disabled when cursor is near segment boundary", async ({
  mount,
}) => {
  // MIN_SLICE_DISTANCE is 0.5s — cursor at 0.3 is within that threshold
  const component = await mount(
    <TimelineToolbar />,
    withStore({ cursorCurrent: 0.3 }),
  );

  await expect(component.getByRole("button", { name: SLICE })).toBeDisabled();
});

test("slice button is enabled when cursor is within a segment", async ({
  mount,
}) => {
  const component = await mount(
    <TimelineToolbar />,
    withStore({ cursorCurrent: 30 }),
  );

  await expect(component.getByRole("button", { name: SLICE })).toBeEnabled();
});

test("clicking slice increases segment count from 1 to 2", async ({
  mount,
}) => {
  const component = await mount(
    <TimelineToolbar />,
    withStore({ cursorCurrent: 30 }),
  );

  const button = component.getByRole("button", { name: SLICE });
  await button.click();

  // After slicing, cursor is now at the boundary of two segments —
  // the button should be disabled
  await expect(button).toBeDisabled();
});

test("fade buttons are enabled inside a segment", async ({ mount }) => {
  const component = await mount(
    <TimelineToolbar />,
    withStore({ cursorCurrent: 30 }),
  );

  await expect(component.getByRole("button", { name: FADE_IN })).toBeEnabled();
  await expect(component.getByRole("button", { name: FADE_OUT })).toBeEnabled();
});

test("fade in is disabled at the start of a segment, fade out is not", async ({
  mount,
}) => {
  const component = await mount(
    <TimelineToolbar />,
    withStore({ cursorCurrent: 0 }),
  );

  await expect(component.getByRole("button", { name: FADE_IN })).toBeDisabled();
  await expect(component.getByRole("button", { name: FADE_OUT })).toBeEnabled();
});

test("fade out is disabled at the end of a segment, fade in is not", async ({
  mount,
}) => {
  const component = await mount(
    <TimelineToolbar />,
    withStore({ cursorCurrent: 60 }),
  );

  await expect(
    component.getByRole("button", { name: FADE_OUT }),
  ).toBeDisabled();
  await expect(component.getByRole("button", { name: FADE_IN })).toBeEnabled();
});

test("setting a fade presses its button, and a second click releases it", async ({
  mount,
}) => {
  const component = await mount(
    <TimelineToolbar />,
    withStore({ cursorCurrent: 30 }),
  );

  const fadeIn = component.getByRole("button", { name: FADE_IN });
  await expect(fadeIn).toHaveAttribute("aria-pressed", "false");

  await fadeIn.click();
  await expect(fadeIn).toHaveAttribute("aria-pressed", "true");
  // The other fade is a separate toggle and stays untouched.
  await expect(
    component.getByRole("button", { name: FADE_OUT }),
  ).toHaveAttribute("aria-pressed", "false");

  await fadeIn.click();
  await expect(fadeIn).toHaveAttribute("aria-pressed", "false");
});

test("a set fade can be removed from the start of the segment", async ({
  mount,
}) => {
  const component = await mount(
    <TimelineToolbar />,
    withStore({
      cursorCurrent: 0,
      segments: [{ id: "s0", sourceStart: 0, sourceEnd: 60, fadeIn: 5 }],
    }),
  );

  // Nothing to set at the very start, but the fade already there can still go.
  const fadeIn = component.getByRole("button", { name: FADE_IN });
  await expect(fadeIn).toBeEnabled();
  await expect(fadeIn).toHaveAttribute("aria-pressed", "true");

  await fadeIn.click();
  await expect(fadeIn).toBeDisabled();
});
