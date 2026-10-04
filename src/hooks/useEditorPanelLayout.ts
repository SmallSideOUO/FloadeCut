import { usePersistedState } from './usePersistedState';

const HEADER_HEIGHT = 41;
const BASELINE_WIDTH = 1463;
const BASELINE_CONTENT_HEIGHT = 761;

const DEFAULT_LIBRARY_RATIO = 406 / BASELINE_WIDTH;
const DEFAULT_TIMELINE_RATIO = 350 / BASELINE_CONTENT_HEIGHT;
const MIN_LIBRARY_RATIO = 176 / BASELINE_WIDTH;
const MIN_PREVIEW_RATIO = 280 / BASELINE_WIDTH;
const MIN_TIMELINE_RATIO = 260 / BASELINE_CONTENT_HEIGHT;
const MIN_UPPER_RATIO = 300 / BASELINE_CONTENT_HEIGHT;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteRatio(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function roundRatio(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function viewportWidth(): number {
  return typeof window === 'undefined' ? BASELINE_WIDTH : Math.max(1, window.innerWidth);
}

function contentHeight(): number {
  if (typeof window === 'undefined') return BASELINE_CONTENT_HEIGHT;
  return Math.max(1, window.innerHeight - HEADER_HEIGHT);
}

export interface EditorPanelLayout {
  gridTemplateColumns: string;
  gridTemplateRows: string;
  resizeLibrary: (delta: number) => void;
  resizeTimeline: (delta: number) => void;
}

/**
 * Keeps user-resized editor panels as viewport-relative ratios. CSS vw/fr tracks
 * then react to both window resizing and browser zoom without a JS resize loop.
 */
export function useEditorPanelLayout(): EditorPanelLayout {
  const [storedLibraryRatio, setLibraryRatio] = usePersistedState(
    'openchatcut.libraryRatio.ui-v2',
    DEFAULT_LIBRARY_RATIO,
  );
  const [storedTimelineRatio, setTimelineRatio] = usePersistedState(
    'openchatcut.timelineRatio.ui-v2',
    DEFAULT_TIMELINE_RATIO,
  );

  const libraryRatio = clamp(finiteRatio(storedLibraryRatio, DEFAULT_LIBRARY_RATIO), MIN_LIBRARY_RATIO, 1 - MIN_PREVIEW_RATIO);
  const timelineRatio = clamp(finiteRatio(storedTimelineRatio, DEFAULT_TIMELINE_RATIO), MIN_TIMELINE_RATIO, 1 - MIN_UPPER_RATIO);
  const gridTemplateColumns = `${libraryRatio * 100}vw 0 minmax(0, 1fr)`;
  const gridTemplateRows = `${HEADER_HEIGHT}px minmax(0, ${1 - timelineRatio}fr) 0 minmax(0, ${timelineRatio}fr)`;

  const resizeLibrary = (delta: number) => setLibraryRatio((current) => {
    return roundRatio(clamp(
      finiteRatio(current, DEFAULT_LIBRARY_RATIO) + delta / viewportWidth(),
      MIN_LIBRARY_RATIO,
      1 - MIN_PREVIEW_RATIO,
    ));
  });
  const resizeTimeline = (delta: number) => setTimelineRatio((current) => roundRatio(clamp(
    finiteRatio(current, DEFAULT_TIMELINE_RATIO) - delta / contentHeight(),
    MIN_TIMELINE_RATIO,
    1 - MIN_UPPER_RATIO,
  )));

  return { gridTemplateColumns, gridTemplateRows, resizeLibrary, resizeTimeline };
}
