import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PlayerRef } from '@remotion/player';
import type { RefObject } from 'react';
import type { ClipEffect, ProjectDoc, TimelineItem, TimelineState } from '../../editor/types';
import { historyReduce, type History } from '../../editor/reduce';
import { FX_EFFECTS } from '../../gl/fx/shaderEffects';
import { fxUniforms } from '../../gl/fx/uniforms';
import { t } from '../../i18n/locale';
import { PreviewTransformOverlay } from './PreviewTransformOverlay';
import { fitPreviewCanvasSize, previewPaddedClientSize, previewStageContentSize } from './previewCanvasGeometry';
import { effectivePreviewTransform } from './previewTransform';
import { createLocalMosaic, LOCAL_MOSAIC_ID, mosaicRect, mosaicToPreview, moveMosaicRect, patchMosaicRect, previewToMosaic } from './localMosaic';

const item: TimelineItem = {
  id: 'card',
  track: 'V2',
  startFrame: 0,
  durationInFrames: 90,
  kind: 'motion-graphic',
  name: '金句卡片',
  width: 1080,
  height: 1920,
  transform: { x: 5, y: -4, scale: 0.8, rotation: 8 },
};

const stateOf = (trackPatch: Record<string, unknown> = {}, selectedId: string | null = 'card'): TimelineState => ({
  fps: 30,
  width: 1080,
  height: 1920,
  fit: 'contain',
  selectedId,
  selectedIds: selectedId ? [selectedId] : [],
  trackOrder: ['V2'],
  tracks: { V2: { kind: 'video', ...trackPatch } },
  items: [item],
});

const playerRef = {
  current: { getCurrentFrame: () => 20, pause: () => undefined } as unknown as PlayerRef,
} as RefObject<PlayerRef | null>;

const props = {
  playerRef,
  onSelectItem: () => undefined,
  onSetItemTransform: () => undefined,
  onSetItemKeyframe: () => undefined,
  onBeginHistoryGesture: () => undefined,
  onEndHistoryGesture: () => undefined,
};

// The canvas wrapper itself must be the contained composition rect. All
// interactive overlays are inset:0 children of this wrapper, so keeping its
// aspect is what makes caption hit boxes and clip handles share one coordinate
// space after an aspect switch.
assert.deepEqual(
  fitPreviewCanvasSize(
    { width: 558, height: 770 },
    { width: 1920, height: 1080 },
  ),
  { width: 558, height: 313.875 },
  '16:9 应在竖向较高的预览栏中按宽度 contain，且宽高共用同一 scale',
);
assert.deepEqual(
  fitPreviewCanvasSize(
    { width: 558, height: 770 },
    { width: 1080, height: 1080 },
  ),
  { width: 558, height: 558 },
  '1:1 应得到正方形命中层与编辑框',
);
assert.deepEqual(
  fitPreviewCanvasSize(
    { width: 900, height: 500 },
    { width: 1080, height: 1920 },
  ),
  { width: 281.25, height: 500 },
  '9:16 应在横向较宽的预览栏中按高度 contain，不能把 281.25 收成 281',
);
{
  const fitted = fitPreviewCanvasSize({ width: 360, height: 776 }, { width: 1080, height: 1920 });
  assert.equal(fitted.width * 1920, fitted.height * 1080, 'preview wrapper aspect must equal the composition');
  assert.deepEqual(fitted, { width: 360, height: 640 });
}
assert.deepEqual(
  previewStageContentSize({
    contentBoxSize: [{ inlineSize: 360, blockSize: 776 }],
    contentRect: { width: 360, height: 776 },
  }),
  { width: 360, height: 776 },
  'stage size is the content box, not clientWidth with padding',
);
assert.deepEqual(
  previewPaddedClientSize(
    { width: 400, height: 800 },
    { left: 20, right: 20, top: 12, bottom: 12 },
  ),
  { width: 360, height: 776 },
  '12px 20px stage padding must not be treated as composition space',
);
const previewPanelSource = readFileSync(new URL('../PreviewPanel.tsx', import.meta.url), 'utf8');
assert.match(
  previewPanelSource,
  /fitPreviewCanvasSize\(stageSize,\s*\{\s*width:\s*state\.width,\s*height:\s*state\.height/s,
  '预览面板必须把 contain 后的同一画布尺寸交给播放器、字幕命中层和片段变换层',
);
assert.match(
  previewPanelSource,
  /previewStageContentSize/,
  'ResizeObserver must use the stage content box so padding is not composition space',
);
assert.match(
  previewPanelSource,
  /previewPaddedClientSize/,
  'first layout must subtract stage padding from clientWidth',
);

// A selected editable clip exposes one compact transform frame and nine handles.
{
  const markup = renderToStaticMarkup(<PreviewTransformOverlay state={stateOf()} {...props} />);
  assert.ok(markup.includes(`aria-label="${t('预览画布片段变换')}"`));
  assert.match(markup, /data-preview-selection="card"/);
  assert.equal((markup.match(/data-preview-handle="scale-[0-3]"/g) ?? []).length, 4, '四个角都应可等比缩放');
  assert.equal((markup.match(/data-preview-handle="crop-[nsew]"/g) ?? []).length, 4, '四边中点应可裁切遮盖');
  assert.equal((markup.match(/data-preview-handle="rotate"/g) ?? []).length, 1, '顶部应有一个旋转手柄');
  assert.match(markup, /var\(--cc-accent\)/, '控制框颜色跟随当前皮肤强调色');
}

// Locked and hidden tracks can never expose writable controls.
for (const trackPatch of [{ locked: true }, { hidden: true }]) {
  const markup = renderToStaticMarkup(<PreviewTransformOverlay state={stateOf(trackPatch)} {...props} />);
  assert.doesNotMatch(markup, /data-preview-selection=/);
  assert.doesNotMatch(markup, /data-preview-handle=/);
}

// A timeline selection outside the current frame must not leave a stale box.
{
  const state = stateOf();
  state.items = [{ ...item, startFrame: 30 }];
  const markup = renderToStaticMarkup(<PreviewTransformOverlay state={state} {...props} />);
  assert.doesNotMatch(markup, /data-preview-selection=/);
}

// Window resize can briefly report a zero-size composition; controls stay hidden until geometry is valid.
{
  const state = stateOf();
  state.width = 0;
  state.height = 0;
  const markup = renderToStaticMarkup(<PreviewTransformOverlay state={state} {...props} />);
  assert.doesNotMatch(markup, /data-preview-selection=/);
  assert.doesNotMatch(markup, /data-preview-handle=/);
}

// Multiple independent mosaic regions expose their own labels and resize handles.
{
  const a = createLocalMosaic([]);
  const b = createLocalMosaic([a]);
  assert.notEqual(a.id, b.id);
  assert.notDeepEqual(mosaicRect(a), mosaicRect(b), 'new regions must not completely hide each other');
  const state = stateOf();
  state.items = [{ ...item, kind: 'image', effects: [a, b] }];
  const markup = renderToStaticMarkup(<PreviewTransformOverlay state={state} {...props} onItemEffectsChange={() => undefined} />);
  assert.equal((markup.match(/data-mosaic-region=/g) ?? []).length, 2);
  assert.equal((markup.match(/data-mosaic-handle=/g) ?? []).length, 8, 'active region has independent width/height handles');
  for (const kind of ['video', 'sequence'] as const) {
    const nested = { ...state, items: [{ ...state.items[0], kind, ...(kind === 'sequence' ? { compound: true, timelineId: 'child' } : {}) }] };
    const controls = renderToStaticMarkup(<PreviewTransformOverlay state={nested} {...props} onItemEffectsChange={() => undefined} />);
    assert.equal((controls.match(/data-mosaic-region=/g) ?? []).length, 2, `${kind} exposes both mosaic regions`);
    assert.equal((controls.match(/data-mosaic-handle=/g) ?? []).length, 8);
  }
  for (const patch of [{ locked: true }, { hidden: true }]) {
    const hidden = { ...state, tracks: { V2: { kind: 'video' as const, ...patch } } };
    assert.doesNotMatch(renderToStaticMarkup(<PreviewTransformOverlay state={hidden} {...props} onItemEffectsChange={() => undefined} />), /data-mosaic-region=/);
  }
  assert.doesNotMatch(renderToStaticMarkup(<PreviewTransformOverlay state={state} {...props} />), /data-mosaic-region=/, 'read-only preview must not expose writable regions');
  const stale = { ...state, items: [{ ...state.items[0], startFrame: 30 }] };
  assert.doesNotMatch(renderToStaticMarkup(<PreviewTransformOverlay state={stale} {...props} onItemEffectsChange={() => undefined} />), /data-mosaic-region=/);

  const before = mosaicRect(a);
  const moved = moveMosaicRect(before, { x: 0.1, y: -0.1 }, 'move');
  const result = patchMosaicRect([a, b], a.id, moved);
  assert.equal(result[1], b, 'editing a region must preserve the other region');
  const uniforms = fxUniforms(FX_EFFECTS[LOCAL_MOSAIC_ID], result[0].overrides);
  assert.ok(Math.abs(uniforms.u_center_x as number - 0.6) < 1e-9);
  assert.ok(Math.abs(uniforms.u_center_y as number - 0.6) < 1e-9, 'upward pointer motion raises bottom-up shader Y');
  assert.ok(Math.abs(mosaicRect(result[0]).y - moved.y) < 1e-9);
}

// Resize keeps the opposite edge fixed, clamps to the source, and preserves other parameters.
{
  const rect = { x: 0.2, y: 0.3, width: 0.4, height: 0.2 };
  const nw = moveMosaicRect(rect, { x: 0.1, y: 0.05 }, 'nw');
  assert.ok(Math.abs(nw.x + nw.width - 0.6) < 1e-9);
  assert.ok(Math.abs(nw.y + nw.height - 0.5) < 1e-9);
  assert.ok(Math.abs(nw.width - 0.3) < 1e-9);
  assert.ok(Math.abs(nw.height - 0.15) < 1e-9);
  const min = moveMosaicRect(rect, { x: -10, y: -10 }, 'se');
  assert.ok(Math.abs(min.width - 0.01) < 1e-9 && Math.abs(min.height - 0.01) < 1e-9);
  assert.deepEqual(moveMosaicRect(rect, { x: 10, y: -10 }, 'move'), { ...rect, x: 0.6, y: 0 });
  const edge = moveMosaicRect({ x: -0.5, y: 0.95, width: 1, height: 0.1 }, { x: 10, y: 10 }, 'se');
  assert.ok(edge.x >= 0 && edge.y >= 0 && edge.x + edge.width <= 1 && edge.y + edge.height <= 1,
    'regions previously positioned past the source edge remain bounded when resized');
  const effect: ClipEffect = { id: 'm', assetId: LOCAL_MOSAIC_ID, overrides: { block_size: 45, feather: 8 } };
  const changed = patchMosaicRect([effect], 'm', nw)[0];
  assert.equal(changed.overrides?.block_size, 45);
  assert.equal(changed.overrides?.feather, 8);
  assert.deepEqual(mosaicRect({ id: 'old', assetId: LOCAL_MOSAIC_ID }), { x: 0.4, y: 0.6, width: 0.2, height: 0.2 }, 'existing shader defaults retain bottom-up Y');
}

// EffectMediaFill rasterizes to the visible source surface, not the letterboxed canvas.
for (const fit of ['contain', 'cover'] as const) {
  for (const rotation of [0, 35, -90]) {
    const state = stateOf();
    state.fit = fit;
    const media: TimelineItem = { ...item, kind: 'image', width: 1920, height: 1080,
      transform: { x: 8, y: -12, scaleX: 0.7, scaleY: 1.2, rotation },
      zoom: { magnification: 1.8, focalPointX: 0.3, focalPointY: 0.4, shape: 'instant' } };
    const candidate = { item: media, localFrame: 20, transform: effectivePreviewTransform(media, 20) };
    for (const point of [{ x: 0, y: 0 }, { x: 0.3, y: 0.7 }, { x: 1, y: 1 }]) {
      const roundTrip = previewToMosaic(state, candidate, mosaicToPreview(state, candidate, point));
      assert.ok(Math.abs(roundTrip.x - point.x) < 1e-9 && Math.abs(roundTrip.y - point.y) < 1e-9);
    }
  }
}
{
  const state = stateOf();
  const media: TimelineItem = { ...item, kind: 'image', width: 1920, height: 1080, transform: undefined };
  const candidate = { item: media, localFrame: 20, transform: effectivePreviewTransform(media, 20) };
  assert.deepEqual(mosaicToPreview(state, candidate, { x: 0, y: 0 }), { x: 0, y: 656 });
  assert.deepEqual(mosaicToPreview(state, candidate, { x: 1, y: 1 }), { x: 1080, y: 1264 });
}

// A continuous drag is one undo entry; all effect parameters survive project serialization.
{
  const a = createLocalMosaic([]);
  const b = createLocalMosaic([a]);
  const state = stateOf();
  state.items = [{ ...item, kind: 'image', effects: [a, b] }];
  const doc = { version: 3, assets: [], mediaFolders: [], activeTimelineId: 'tl',
    timelines: [{ ...state, id: 'tl', name: 'main', order: 0 }] } as ProjectDoc;
  let history: History = { past: [], present: doc, future: [] };
  history = historyReduce(history, { type: 'history.beginGesture' });
  for (const x of [0.1, 0.2, 0.3]) {
    history = historyReduce(history, { type: 'setEffects', id: item.id,
      effects: patchMosaicRect([a, b], a.id, moveMosaicRect(mosaicRect(a), { x, y: 0 }, 'move')) });
  }
  history = historyReduce(history, { type: 'history.endGesture' });
  assert.equal(history.past.length, 1);
  assert.deepEqual(historyReduce(history, { type: 'undo' }).present.timelines[0].items[0].effects, [a, b]);
  assert.deepEqual(JSON.parse(JSON.stringify(history.present)).timelines[0].items[0].effects, history.present.timelines[0].items[0].effects);
}

console.log('preview-transform-overlay.verify: ok (transform controls, multi-region mosaic, geometry, resize, shader coordinates, history and serialization)');
