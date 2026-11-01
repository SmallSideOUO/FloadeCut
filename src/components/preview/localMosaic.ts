import type { ClipEffect, TimelineItem, TimelineState } from '../../editor/types';
import { isBackgroundFillActive } from '../../editor/backgroundFill';
import { visibleVisualFrameRect } from '../../editor/visualFrameGeometry';
import { zoomAt } from '../../editor/zoom';
import {
  applyTransform, inverseTransform, type PreviewCandidate, type PreviewPoint, type PreviewRect,
} from './previewTransform';

export const LOCAL_MOSAIC_ID = 'builtin:fx-local-mosaic';
export type MosaicHandle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function createLocalMosaic(effects: readonly ClipEffect[]): ClipEffect {
  const count = effects.filter((effect) => effect.assetId === LOCAL_MOSAIC_ID).length;
  return {
    id: `fx_${crypto.randomUUID()}`, assetId: LOCAL_MOSAIC_ID,
    overrides: { center_x: 0.5 + (count % 3) * 0.08, center_y: 0.5 - (count % 3) * 0.08 },
  };
}

/** Top-down normalized box. Shader Y is bottom-up; preserve saved project semantics. */
export function mosaicRect(effect: ClipEffect): PreviewRect {
  const param = (key: string, fallback: number) => {
    const value = effect.overrides?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0, 1) : fallback;
  };
  const width = param('width_ratio', 0.2);
  const height = param('height_ratio', 0.2);
  return { x: param('center_x', 0.5) - width / 2, y: 1 - param('center_y', 0.3) - height / 2, width, height };
}

export function moveMosaicRect(rect: PreviewRect, delta: PreviewPoint, handle: MosaicHandle): PreviewRect {
  if (handle === 'move') {
    return { ...rect, x: clamp(rect.x + delta.x, 0, 1 - rect.width), y: clamp(rect.y + delta.y, 0, 1 - rect.height) };
  }
  const min = 0.01;
  let left = clamp(rect.x, 0, 1 - min);
  let right = clamp(rect.x + rect.width, left + min, 1);
  let top = clamp(rect.y, 0, 1 - min);
  let bottom = clamp(rect.y + rect.height, top + min, 1);
  if (handle.includes('w')) left = clamp(left + delta.x, 0, right - min);
  if (handle.includes('e')) right = clamp(right + delta.x, left + min, 1);
  if (handle.includes('n')) top = clamp(top + delta.y, 0, bottom - min);
  if (handle.includes('s')) bottom = clamp(bottom + delta.y, top + min, 1);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function patchMosaicRect(effects: readonly ClipEffect[], id: string, rect: PreviewRect): ClipEffect[] {
  return effects.map((effect) => effect.id === id ? {
    ...effect,
    overrides: {
      ...effect.overrides, center_x: rect.x + rect.width / 2, center_y: 1 - rect.y - rect.height / 2,
      width_ratio: rect.width, height_ratio: rect.height,
    },
  } : effect);
}

function mediaRect(state: TimelineState, item: TimelineItem) {
  return visibleVisualFrameRect(state, { width: item.width ?? state.width, height: item.height ?? state.height },
    isBackgroundFillActive(state, item) ? 'contain' : (state.fit ?? 'contain'));
}

/** Match EffectMediaFill's surface, then ClipWrapper's zoom and clip transform. */
export function mosaicToPreview(state: TimelineState, candidate: PreviewCandidate, point: PreviewPoint): PreviewPoint {
  const rect = mediaRect(state, candidate.item);
  let local = { x: rect.x + point.x * rect.width, y: rect.y + point.y * rect.height };
  if (candidate.item.zoom) {
    const zoom = zoomAt(candidate.item.zoom, candidate.localFrame, candidate.item.durationInFrames);
    const origin = { x: zoom.focalX * state.width, y: zoom.focalY * state.height };
    local = { x: origin.x + (local.x - origin.x) * zoom.magnification, y: origin.y + (local.y - origin.y) * zoom.magnification };
  }
  return applyTransform(state, local, candidate.transform);
}

export function previewToMosaic(state: TimelineState, candidate: PreviewCandidate, point: PreviewPoint): PreviewPoint {
  const rect = mediaRect(state, candidate.item);
  let local = inverseTransform(state, point, candidate.transform);
  if (candidate.item.zoom) {
    const zoom = zoomAt(candidate.item.zoom, candidate.localFrame, candidate.item.durationInFrames);
    const origin = { x: zoom.focalX * state.width, y: zoom.focalY * state.height };
    local = { x: origin.x + (local.x - origin.x) / zoom.magnification, y: origin.y + (local.y - origin.y) / zoom.magnification };
  }
  return { x: (local.x - rect.x) / rect.width, y: (local.y - rect.y) / rect.height };
}
