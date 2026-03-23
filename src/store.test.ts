import { describe, test, expect, beforeEach } from "vitest";
import { useAppStore } from "./store";

describe("useAppStore", () => {
  beforeEach(() => {
    useAppStore.setState({
      cursorCurrent: 0,
      cursorStart: 0,
      cursorEnd: 0,
    });
  });

  describe("setCursorStart", () => {
    test("sets cursorStart", () => {
      useAppStore.getState().setCursorStart(5);
      expect(useAppStore.getState().cursorStart).toBe(5);
    });

    test("clamps cursorCurrent up when below new start", () => {
      useAppStore.setState({ cursorCurrent: 2, cursorEnd: 10 });
      useAppStore.getState().setCursorStart(5);
      expect(useAppStore.getState().cursorCurrent).toBe(5);
    });

    test("does not change cursorCurrent when already past start", () => {
      useAppStore.setState({ cursorCurrent: 8, cursorEnd: 10 });
      useAppStore.getState().setCursorStart(5);
      expect(useAppStore.getState().cursorCurrent).toBe(8);
    });
  });

  describe("setCursorEnd", () => {
    test("sets cursorEnd", () => {
      useAppStore.getState().setCursorEnd(10);
      expect(useAppStore.getState().cursorEnd).toBe(10);
    });

    test("clamps cursorCurrent down when above new end", () => {
      useAppStore.setState({ cursorCurrent: 8, cursorStart: 0 });
      useAppStore.getState().setCursorEnd(5);
      expect(useAppStore.getState().cursorCurrent).toBe(5);
    });

    test("does not change cursorCurrent when already before end", () => {
      useAppStore.setState({ cursorCurrent: 3, cursorStart: 0 });
      useAppStore.getState().setCursorEnd(5);
      expect(useAppStore.getState().cursorCurrent).toBe(3);
    });
  });

  describe("resetCursors", () => {
    test("resets start to 0, end to duration, current to 0", () => {
      useAppStore.setState({
        cursorStart: 5,
        cursorEnd: 8,
        cursorCurrent: 6,
      });
      useAppStore.getState().resetCursors(10);
      const state = useAppStore.getState();
      expect(state.cursorStart).toBe(0);
      expect(state.cursorEnd).toBe(10);
      expect(state.cursorCurrent).toBe(0);
    });
  });
});
