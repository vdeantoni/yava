import { describe, test, expect, beforeEach } from "vitest";
import { useAppStore } from "./store";

const initSegments = (duration: number) => {
  useAppStore.getState().resetCursors(duration);
};

describe("useAppStore", () => {
  beforeEach(() => {
    useAppStore.setState({
      cursorCurrent: 0,
      cursorStart: 0,
      cursorEnd: 0,
      segments: [],
      selectedSegmentId: null,
      nextSegmentId: 0,
    });
  });

  describe("setCursorStart", () => {
    test("sets cursorStart", () => {
      initSegments(10);
      useAppStore.getState().setCursorStart(5);
      expect(useAppStore.getState().cursorStart).toBe(5);
    });

    test("clamps cursorCurrent up when below new start", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 2 });
      useAppStore.getState().setCursorStart(5);
      expect(useAppStore.getState().cursorCurrent).toBe(5);
    });

    test("does not change cursorCurrent when already past start", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 8 });
      useAppStore.getState().setCursorStart(5);
      expect(useAppStore.getState().cursorCurrent).toBe(8);
    });

    test("syncs first segment sourceStart", () => {
      initSegments(10);
      useAppStore.getState().setCursorStart(3);
      const { segments } = useAppStore.getState();
      expect(segments[0].sourceStart).toBe(3);
    });
  });

  describe("setCursorEnd", () => {
    test("sets cursorEnd", () => {
      initSegments(10);
      useAppStore.getState().setCursorEnd(5);
      expect(useAppStore.getState().cursorEnd).toBe(5);
    });

    test("clamps cursorCurrent down when above new end", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 8 });
      useAppStore.getState().setCursorEnd(5);
      expect(useAppStore.getState().cursorCurrent).toBe(5);
    });

    test("does not change cursorCurrent when already before end", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 3 });
      useAppStore.getState().setCursorEnd(5);
      expect(useAppStore.getState().cursorCurrent).toBe(3);
    });

    test("syncs last segment sourceEnd", () => {
      initSegments(10);
      useAppStore.getState().setCursorEnd(7);
      const { segments } = useAppStore.getState();
      expect(segments[segments.length - 1].sourceEnd).toBe(7);
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

    test("initializes segments to single segment spanning duration", () => {
      useAppStore.getState().resetCursors(20);
      const { segments, selectedSegmentId, nextSegmentId } =
        useAppStore.getState();
      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({
        id: "s0",
        sourceStart: 0,
        sourceEnd: 20,
      });
      expect(selectedSegmentId).toBeNull();
      expect(nextSegmentId).toBe(1);
    });
  });

  describe("sliceAtCursor", () => {
    test("splits segment at cursor position", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 5 });
      useAppStore.getState().sliceAtCursor();
      const { segments } = useAppStore.getState();
      expect(segments).toHaveLength(2);
      expect(segments[0].sourceStart).toBe(0);
      expect(segments[0].sourceEnd).toBe(5);
      expect(segments[1].sourceStart).toBe(5);
      expect(segments[1].sourceEnd).toBe(10);
    });

    test("does not slice when cursor is too close to start edge", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 0.3 });
      useAppStore.getState().sliceAtCursor();
      expect(useAppStore.getState().segments).toHaveLength(1);
    });

    test("does not slice when cursor is too close to end edge", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 9.8 });
      useAppStore.getState().sliceAtCursor();
      expect(useAppStore.getState().segments).toHaveLength(1);
    });

    test("clears selectedSegmentId after slice", () => {
      initSegments(10);
      useAppStore.setState({
        cursorCurrent: 5,
        selectedSegmentId: "s0",
      });
      useAppStore.getState().sliceAtCursor();
      expect(useAppStore.getState().selectedSegmentId).toBeNull();
    });

    test("can slice a segment that was already sliced", () => {
      initSegments(20);
      useAppStore.setState({ cursorCurrent: 10 });
      useAppStore.getState().sliceAtCursor();
      expect(useAppStore.getState().segments).toHaveLength(2);

      useAppStore.setState({ cursorCurrent: 5 });
      useAppStore.getState().sliceAtCursor();
      const { segments } = useAppStore.getState();
      expect(segments).toHaveLength(3);
      expect(segments[0].sourceEnd).toBe(5);
      expect(segments[1].sourceStart).toBe(5);
      expect(segments[1].sourceEnd).toBe(10);
      expect(segments[2].sourceStart).toBe(10);
    });

    test("does not slice when cursor is in a gap", () => {
      initSegments(30);
      // Create 3 segments: [0,10], [10,20], [20,30]
      useAppStore.setState({ cursorCurrent: 10 });
      useAppStore.getState().sliceAtCursor();
      useAppStore.setState({ cursorCurrent: 20 });
      useAppStore.getState().sliceAtCursor();
      expect(useAppStore.getState().segments).toHaveLength(3);

      // Delete middle segment
      const midId = useAppStore.getState().segments[1].id;
      useAppStore.getState().deleteSegment(midId);
      expect(useAppStore.getState().segments).toHaveLength(2);

      // Try to slice at 15 (now a gap)
      useAppStore.setState({ cursorCurrent: 15 });
      useAppStore.getState().sliceAtCursor();
      expect(useAppStore.getState().segments).toHaveLength(2);
    });
  });

  describe("deleteSegment", () => {
    test("removes the specified segment", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 5 });
      useAppStore.getState().sliceAtCursor();
      const { segments } = useAppStore.getState();
      expect(segments).toHaveLength(2);

      useAppStore.getState().deleteSegment(segments[0].id);
      const after = useAppStore.getState();
      expect(after.segments).toHaveLength(1);
      expect(after.segments[0].sourceStart).toBe(5);
    });

    test("does not delete when only one segment", () => {
      initSegments(10);
      useAppStore.getState().deleteSegment("s0");
      expect(useAppStore.getState().segments).toHaveLength(1);
    });

    test("updates cursorStart/cursorEnd from remaining segments", () => {
      initSegments(30);
      useAppStore.setState({ cursorCurrent: 10 });
      useAppStore.getState().sliceAtCursor();
      useAppStore.setState({ cursorCurrent: 20 });
      useAppStore.getState().sliceAtCursor();

      // Delete first segment [0,10]
      const firstId = useAppStore.getState().segments[0].id;
      useAppStore.getState().deleteSegment(firstId);

      const state = useAppStore.getState();
      expect(state.cursorStart).toBe(10);
      expect(state.cursorEnd).toBe(30);
    });

    test("snaps cursor to nearest segment boundary when in deleted region", () => {
      initSegments(30);
      useAppStore.setState({ cursorCurrent: 10 });
      useAppStore.getState().sliceAtCursor();
      useAppStore.setState({ cursorCurrent: 20 });
      useAppStore.getState().sliceAtCursor();

      // Position cursor in middle segment, then delete it
      const midId = useAppStore.getState().segments[1].id;
      useAppStore.setState({ cursorCurrent: 15 });
      useAppStore.getState().deleteSegment(midId);

      // Cursor should snap to nearest edge (10 or 20)
      const { cursorCurrent } = useAppStore.getState();
      expect(cursorCurrent === 10 || cursorCurrent === 20).toBe(true);
    });

    test("clears selectedSegmentId after delete", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 5 });
      useAppStore.getState().sliceAtCursor();
      const segId = useAppStore.getState().segments[0].id;
      useAppStore.setState({ selectedSegmentId: segId });
      useAppStore.getState().deleteSegment(segId);
      expect(useAppStore.getState().selectedSegmentId).toBeNull();
    });

    test("does nothing when id does not exist", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 5 });
      useAppStore.getState().sliceAtCursor();
      useAppStore.getState().deleteSegment("nonexistent");
      expect(useAppStore.getState().segments).toHaveLength(2);
    });
  });

  describe("selectSegment", () => {
    test("sets selectedSegmentId", () => {
      initSegments(10);
      useAppStore.getState().selectSegment("s0");
      expect(useAppStore.getState().selectedSegmentId).toBe("s0");
    });

    test("clears selectedSegmentId when null", () => {
      initSegments(10);
      useAppStore.getState().selectSegment("s0");
      useAppStore.getState().selectSegment(null);
      expect(useAppStore.getState().selectedSegmentId).toBeNull();
    });
  });
});
