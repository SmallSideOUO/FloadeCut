import type { ClipEffect } from './types';

export const SEQUENCE_MOSAIC_ID = 'builtin:fx-local-mosaic';

export function sequenceMosaicParams(effect: ClipEffect, width: number, height: number) {
  const param = (key: string, fallback: number, min: number, max: number) => {
    const value = effect.overrides?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  };
  const w = param('width_ratio', 0.2, 0, 1) * width;
  const h = param('height_ratio', 0.2, 0, 1) * height;
  return {
    x: param('center_x', 0.5, 0, 1) * width - w / 2,
    y: (1 - param('center_y', 0.3, 0, 1)) * height - h / 2,
    width: w, height: h, block: Math.round(param('block_size', 20, 1, 200)),
    feather: Math.min(param('feather', 4, 0, 100), w / 2, h / 2),
  };
}
