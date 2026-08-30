import { describe, test, expect, beforeEach } from "vitest";
import { useAppStore, type UrlEditState } from "./store";
import { FLUSH_TOLERANCE, MIN_SLICE_DISTANCE } from "./lib/utils";

const initSegments = (duration: number) => {
  useAppStore.getState().resetCursors(duration);
};

describe("useAppStore", () => {
  beforeEach(() => {
    // Reset every field the tests touch. Segment/cursor state alone is not
    // enough: export options leak between tests otherwise.
    useAppStore.setState({
      cursorCurrent: 0,
      cursorStart: 0,
      cursorEnd: 0,
      segments: [],
      selectedSegmentId: null,
      nextSegmentId: 0,
      cropRectangle: { x: 0, y: 0, w: 0, h: 0, vw: 0, vh: 0 },
      pendingEditState: null,
      file: undefined,
      video: undefined!,
      sourceUrl: null,
      format: "mp4",
      preset: "ultrafast",
      frameRate: 30,
      speed: 1,
      outputWidth: "",
      outputHeight: "",
      noAudio: false,
    });
  });

  describe("updateSegmentBounds (start)", () => {
    test("updates cursorStart via first segment", () => {
      initSegments(10);
      const { segments } = useAppStore.getState();
      useAppStore.getState().updateSegmentBounds(segments[0].id, 5, 10);
      expect(useAppStore.getState().cursorStart).toBe(5);
    });

    test("clamps cursorCurrent up when below new start", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 2 });
      const { segments } = useAppStore.getState();
      useAppStore.getState().updateSegmentBounds(segments[0].id, 5, 10);
      expect(useAppStore.getState().cursorCurrent).toBe(5);
    });

    test("does not change cursorCurrent when already past start", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 8 });
      const { segments } = useAppStore.getState();
      useAppStore.getState().updateSegmentBounds(segments[0].id, 5, 10);
      expect(useAppStore.getState().cursorCurrent).toBe(8);
    });

    test("syncs first segment sourceStart", () => {
      initSegments(10);
      const { segments } = useAppStore.getState();
      useAppStore.getState().updateSegmentBounds(segments[0].id, 3, 10);
      expect(useAppStore.getState().segments[0].sourceStart).toBe(3);
    });
  });

  describe("updateSegmentBounds (end)", () => {
    test("updates cursorEnd via last segment", () => {
      initSegments(10);
      const { segments } = useAppStore.getState();
      useAppStore.getState().updateSegmentBounds(segments[0].id, 0, 5);
      expect(useAppStore.getState().cursorEnd).toBe(5);
    });

    test("clamps cursorCurrent down when above new end", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 8 });
      const { segments } = useAppStore.getState();
      useAppStore.getState().updateSegmentBounds(segments[0].id, 0, 5);
      expect(useAppStore.getState().cursorCurrent).toBe(5);
    });

    test("does not change cursorCurrent when already before end", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 3 });
      const { segments } = useAppStore.getState();
      useAppStore.getState().updateSegmentBounds(segments[0].id, 0, 5);
      expect(useAppStore.getState().cursorCurrent).toBe(3);
    });

    test("syncs last segment sourceEnd", () => {
      initSegments(10);
      const { segments } = useAppStore.getState();
      useAppStore.getState().updateSegmentBounds(segments[0].id, 0, 7);
      expect(useAppStore.getState().segments[0].sourceEnd).toBe(7);
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

  describe("fadeAtCursor", () => {
    test("fades in from the start of the segment to the cursor", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 3 });
      useAppStore.getState().fadeAtCursor("in");
      expect(useAppStore.getState().segments[0].fadeIn).toBe(3);
    });

    test("fades out from the cursor to the end of the segment", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 7 });
      useAppStore.getState().fadeAtCursor("out");
      expect(useAppStore.getState().segments[0].fadeOut).toBe(3);
    });

    test("removes the fade from anywhere in the segment, not just its edge", () => {
      initSegments(10);
      useAppStore.setState({ cursorCurrent: 3 });
      useAppStore.getState().fadeAtCursor("in");
      useAppStore.setState({ cursorCurrent: 8 });
      useAppStore.getState().fadeAtCursor("in");
      expect(useAppStore.getState().segments[0].fadeIn).toBeUndefined();
    });

    test("slicing leaves each fade on the half that still has its edge", () => {
      initSegments(20);
      useAppStore.setState({ cursorCurrent: 3 });
      useAppStore.getState().fadeAtCursor("in");
      useAppStore.setState({ cursorCurrent: 18 });
      useAppStore.getState().fadeAtCursor("out");

      useAppStore.setState({ cursorCurrent: 10 });
      useAppStore.getState().sliceAtCursor();

      const { segments } = useAppStore.getState();
      expect(segments[0].fadeIn).toBe(3);
      expect(segments[0].fadeOut).toBeUndefined();
      expect(segments[1].fadeIn).toBeUndefined();
      expect(segments[1].fadeOut).toBe(2);
    });

    test("slicing cuts back a fade the new half cannot hold", () => {
      initSegments(20);
      useAppStore.setState({ cursorCurrent: 15 });
      useAppStore.getState().fadeAtCursor("in");

      useAppStore.setState({ cursorCurrent: 10 });
      useAppStore.getState().sliceAtCursor();

      expect(useAppStore.getState().segments[0].fadeIn).toBe(10);
    });

    test("joining keeps the fades on the outer edges", () => {
      initSegments(20);
      useAppStore.setState({ cursorCurrent: 10 });
      useAppStore.getState().sliceAtCursor();

      useAppStore.setState({ cursorCurrent: 2 });
      useAppStore.getState().fadeAtCursor("in");
      useAppStore.setState({ cursorCurrent: 18 });
      useAppStore.getState().fadeAtCursor("out");
      // Fades on the inner cut have nowhere to go once the cut is gone.
      useAppStore.setState({ cursorCurrent: 9 });
      useAppStore.getState().fadeAtCursor("out");
      useAppStore.setState({ cursorCurrent: 11 });
      useAppStore.getState().fadeAtCursor("in");

      const first = useAppStore.getState().segments[0].id;
      useAppStore.getState().joinSegment(first);

      const { segments } = useAppStore.getState();
      expect(segments).toHaveLength(1);
      expect(segments[0].fadeIn).toBe(2);
      expect(segments[0].fadeOut).toBe(2);
    });

    test("dragging a segment shorter cuts its fade back to fit", () => {
      initSegments(20);
      useAppStore.setState({ cursorCurrent: 8 });
      useAppStore.getState().fadeAtCursor("in");

      const { segments } = useAppStore.getState();
      useAppStore.getState().updateSegmentBounds(segments[0].id, 0, 5);

      expect(useAppStore.getState().segments[0].fadeIn).toBe(5);
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

  describe("joinSegment", () => {
    /** Seed arbitrary segments, bypassing slice/delete. */
    const seed = (bounds: [number, number][]) => {
      useAppStore.setState({
        segments: bounds.map(([sourceStart, sourceEnd], i) => ({
          id: `s${i}`,
          sourceStart,
          sourceEnd,
        })),
        nextSegmentId: bounds.length,
        cursorStart: bounds[0][0],
        cursorEnd: bounds[bounds.length - 1][1],
      });
    };

    test("merges two flush segments into one", () => {
      seed([
        [0, 10],
        [10, 20],
      ]);
      useAppStore.getState().joinSegment("s1");

      const { segments } = useAppStore.getState();
      expect(segments).toHaveLength(1);
      expect(segments[0].sourceStart).toBe(0);
      expect(segments[0].sourceEnd).toBe(20);
    });

    test("merges an entire run of flush segments", () => {
      seed([
        [0, 5],
        [5, 10],
        [10, 15],
      ]);
      useAppStore.getState().joinSegment("s1");

      const { segments } = useAppStore.getState();
      expect(segments).toHaveLength(1);
      expect(segments[0].sourceEnd).toBe(15);
    });

    test("stops at a gap, leaving the far segment alone", () => {
      seed([
        [0, 10],
        [10, 20],
        [30, 40],
      ]);
      useAppStore.getState().joinSegment("s0");

      const { segments } = useAppStore.getState();
      expect(segments).toHaveLength(2);
      expect(segments[0]).toMatchObject({ sourceStart: 0, sourceEnd: 20 });
      expect(segments[1]).toMatchObject({ sourceStart: 30, sourceEnd: 40 });
    });

    test("treats a sub-tolerance gap as flush", () => {
      seed([
        [0, 10],
        [10 + FLUSH_TOLERANCE / 2, 20],
      ]);
      useAppStore.getState().joinSegment("s0");
      expect(useAppStore.getState().segments).toHaveLength(1);
    });

    test("does not join across a gap wider than the tolerance", () => {
      seed([
        [0, 10],
        [10 + FLUSH_TOLERANCE * 2, 20],
      ]);
      useAppStore.getState().joinSegment("s0");
      expect(useAppStore.getState().segments).toHaveLength(2);
    });

    test("does nothing when the segment has no flush neighbour", () => {
      seed([
        [0, 10],
        [20, 30],
      ]);
      const before = useAppStore.getState().segments;
      useAppStore.getState().joinSegment("s0");
      expect(useAppStore.getState().segments).toBe(before);
    });

    test("does nothing for a lone segment", () => {
      seed([[0, 10]]);
      const before = useAppStore.getState().segments;
      useAppStore.getState().joinSegment("s0");
      expect(useAppStore.getState().segments).toBe(before);
    });

    test("does nothing for an unknown id", () => {
      seed([
        [0, 10],
        [10, 20],
      ]);
      const before = useAppStore.getState().segments;
      useAppStore.getState().joinSegment("nope");
      expect(useAppStore.getState().segments).toBe(before);
    });

    test("selects the merged segment under a fresh id", () => {
      seed([
        [0, 10],
        [10, 20],
      ]);
      useAppStore.getState().joinSegment("s1");

      const { segments, selectedSegmentId, nextSegmentId } =
        useAppStore.getState();
      expect(selectedSegmentId).toBe(segments[0].id);
      expect(segments[0].id).toBe("s2");
      expect(nextSegmentId).toBe(3);
    });

    test("recomputes the cursors from the merged result", () => {
      seed([
        [2, 10],
        [10, 20],
        [30, 42],
      ]);
      useAppStore.getState().joinSegment("s0");

      const { cursorStart, cursorEnd } = useAppStore.getState();
      expect(cursorStart).toBe(2);
      expect(cursorEnd).toBe(42);
    });
  });

  describe("resetCursors with a restored URL state", () => {
    const withPending = (editState: UrlEditState, duration = 60) => {
      useAppStore.setState({ pendingEditState: editState });
      useAppStore.getState().resetCursors(duration);
      return useAppStore.getState();
    };

    test("clamps a segment end beyond the duration", () => {
      const { segments } = withPending({ seg: [[10, 9999]] });
      expect(segments).toEqual([{ id: "s0", sourceStart: 10, sourceEnd: 60 }]);
    });

    test("clamps a negative segment start to zero", () => {
      const { segments } = withPending({ seg: [[-30, 20]] });
      expect(segments[0].sourceStart).toBe(0);
    });

    test("drops segments shorter than the minimum slice distance", () => {
      const { segments } = withPending({
        seg: [
          [0, 10],
          [20, 20 + MIN_SLICE_DISTANCE / 2],
          [30, 40],
        ],
      });
      expect(segments.map((s) => [s.sourceStart, s.sourceEnd])).toEqual([
        [0, 10],
        [30, 40],
      ]);
    });

    test("keeps a segment exactly at the minimum slice distance", () => {
      const { segments } = withPending({
        seg: [[0, MIN_SLICE_DISTANCE]],
      });
      expect(segments).toHaveLength(1);
    });

    test("restores the fades carried in the longer tuple", () => {
      const { segments } = withPending({ seg: [[0, 30, 1.5, 2]] });
      expect(segments[0].fadeIn).toBe(1.5);
      expect(segments[0].fadeOut).toBe(2);
    });

    test("cuts a restored fade back to the segment it landed on", () => {
      // The end clamps to the duration, which can leave the fade too long.
      const { segments } = withPending({ seg: [[0, 9999, 90, 0]] });
      expect(segments[0].fadeIn).toBe(60);
    });

    test("sorts segments that arrive out of order", () => {
      const { segments } = withPending({
        seg: [
          [30, 40],
          [0, 10],
        ],
      });
      expect(segments.map((s) => s.sourceStart)).toEqual([0, 30]);
    });

    test("falls back to the full-duration default when every segment is dropped", () => {
      const { segments } = withPending({ seg: [[5, 5.1]] });
      expect(segments).toEqual([{ id: "s0", sourceStart: 0, sourceEnd: 60 }]);
    });

    test("parks the cursor at the first segment's start", () => {
      const { cursorCurrent, cursorStart, cursorEnd } = withPending({
        seg: [
          [12, 20],
          [30, 44],
        ],
      });
      expect(cursorCurrent).toBe(12);
      expect(cursorStart).toBe(12);
      expect(cursorEnd).toBe(44);
    });

    test("restores the export options", () => {
      const s = withPending({
        fmt: "webm",
        pre: "slow",
        fps: 24,
        spd: 1.5,
        na: true,
      });
      expect(s.format).toBe("webm");
      expect(s.preset).toBe("slow");
      expect(s.frameRate).toBe(24);
      expect(s.speed).toBe(1.5);
      expect(s.noAudio).toBe(true);
    });

    test("leaves defaults in place for an empty restored state", () => {
      const s = withPending({});
      expect(s.format).toBe("mp4");
      expect(s.segments).toHaveLength(1);
      expect(s.segments[0].sourceEnd).toBe(60);
    });
  });

  describe("resetExportOptions", () => {
    test("restores the export defaults", () => {
      useAppStore.setState({
        format: "gif",
        preset: "slow",
        frameRate: 12,
        speed: 4,
        noAudio: true,
      });
      useAppStore.getState().resetExportOptions();

      const s = useAppStore.getState();
      expect(s.format).toBe("mp4");
      expect(s.preset).toBe("ultrafast");
      expect(s.frameRate).toBe(30);
      expect(s.speed).toBe(1);
      expect(s.noAudio).toBe(false);
    });

    test("clears the output size back to automatic", () => {
      useAppStore.setState({
        video: { videoWidth: 1920, videoHeight: 1080 } as HTMLVideoElement,
        outputWidth: "640",
        outputHeight: "480",
      });
      useAppStore.getState().resetExportOptions();

      // Blank means "derive it from the source and the crop".
      const s = useAppStore.getState();
      expect(s.outputWidth).toBe("");
      expect(s.outputHeight).toBe("");
    });

    test("clears the crop rectangle", () => {
      useAppStore.setState({
        cropRectangle: { x: 1, y: 2, w: 3, h: 4, vw: 5, vh: 6 },
      });
      useAppStore.getState().resetExportOptions();

      expect(useAppStore.getState().cropRectangle).toEqual({
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        vw: 0,
        vh: 0,
      });
    });
  });

  describe("reset", () => {
    test("clears the loaded file and its source URL", () => {
      useAppStore.setState({
        file: new Blob(["x"]),
        sourceUrl: "https://ex.com/a.mp4",
      });
      useAppStore.getState().reset();

      const s = useAppStore.getState();
      expect(s.file).toBeUndefined();
      expect(s.sourceUrl).toBeNull();
    });

    test("clears segments, cursors and selection", () => {
      initSegments(30);
      useAppStore.getState().selectSegment("s0");
      useAppStore.getState().reset();

      const s = useAppStore.getState();
      expect(s.segments).toEqual([]);
      expect(s.cursorStart).toBe(0);
      expect(s.cursorEnd).toBe(0);
      expect(s.cursorCurrent).toBe(0);
      expect(s.selectedSegmentId).toBeNull();
      expect(s.nextSegmentId).toBe(0);
    });

    test("restores the export defaults", () => {
      useAppStore.setState({ format: "gif", speed: 4, noAudio: true });
      useAppStore.getState().reset();

      const s = useAppStore.getState();
      expect(s.format).toBe("mp4");
      expect(s.speed).toBe(1);
      expect(s.noAudio).toBe(false);
    });

    test("discards any pending restored URL state", () => {
      useAppStore.setState({ pendingEditState: { fmt: "webm" } });
      useAppStore.getState().reset();
      expect(useAppStore.getState().pendingEditState).toBeNull();
    });

    test("strips the share hash from the address bar", () => {
      window.history.replaceState({}, "", "/?v=x#abc123");
      expect(window.location.hash).not.toBe("");

      useAppStore.getState().reset();

      expect(window.location.hash).toBe("");
      expect(window.location.search).toBe("");
    });
  });
});
