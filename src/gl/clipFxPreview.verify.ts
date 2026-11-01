import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./ClipFx.tsx', import.meta.url), 'utf8');

assert.doesNotMatch(
  source,
  /import \{[^}]*\bVideo\b[^}]*\} from 'remotion'/,
  'effect preview must not reintroduce the HTML video decoder path',
);
assert.match(
  source,
  /<MediaVideo[\s\S]*onVideoFrame=\{onVideoFrame\}/,
  'effect preview must receive decoded frames from @remotion/media',
);
assert.doesNotMatch(
  source,
  /setRenderedKey\(renderKey\)/,
  'effect playback must not schedule a second React render for every decoded frame',
);

// A paused decoder will not send another frame just because a uniform changes.
// Source readiness must survive effect edits, but never reuse pixels from a
// different seek/source/fit/rate. Exercise the actual key expression in ClipFx.
const sourceKeyBody = source.match(/const sourceKey = useMemo\(\s*\(\) => (JSON\.stringify\([^\n]+\)),/);
assert.ok(sourceKeyBody, 'decoded source identity must be separate from shader output identity');
const keyFor = new Function('item', 'frame', 'fit', 'width', 'height', 'trimBefore', 'videoDecoder', `return ${sourceKeyBody[1]}`) as (
  item: { src: string; playbackRate?: number; effects?: unknown[] }, frame: number, fit: string,
  width: number, height: number, trimBefore: number, videoDecoder: string,
) => string;
const item = { src: '/video.mp4', playbackRate: 1, effects: [{ overrides: { center_x: 0.2 } }] };
const before = keyFor(item, 10, 'contain', 1920, 1080, 0, 'media');
assert.equal(keyFor({ ...item, effects: [{ overrides: { center_x: 0.8 } }] }, 10, 'contain', 1920, 1080, 0, 'media'), before,
  'dragging a paused mosaic must reuse the current decoded video frame');
assert.equal(keyFor({ ...item, effects: [] }, 10, 'contain', 1920, 1080, 0, 'media'), before,
  'adding/removing/reordering effects must not require another decoded frame');
for (const key of [
  keyFor(item, 11, 'contain', 1920, 1080, 0, 'media'),
  keyFor({ ...item, src: '/relinked.mp4' }, 10, 'contain', 1920, 1080, 0, 'media'),
  keyFor({ ...item, playbackRate: 2 }, 10, 'contain', 1920, 1080, 0, 'media'),
  keyFor(item, 10, 'cover', 1920, 1080, 0, 'media'),
  keyFor(item, 10, 'contain', 1080, 1920, 0, 'media'),
  keyFor(item, 10, 'contain', 1920, 1080, 5, 'media'),
  keyFor(item, 10, 'contain', 1920, 1080, 0, 'offthread'),
]) assert.notEqual(key, before, 'changes to decoded pixels must invalidate staging');
assert.match(source, /stagedSourceKeyRef\.current === sourceKey/, 'readiness compares decoded pixels, not uniforms');
assert.match(source, /stagedSourceKeyRef\.current = sourceKey;[\s\S]*?\[fit, sourceKey, staging\]/,
  'preview decoder callback remains stable through effect-only edits');
assert.match(source, /stagedSourceKeyRef\.current = target\.sourceKey/, 'offthread export uses the same source identity');
assert.doesNotMatch(source, /stagedRenderKeyRef/, 'shader output keys must not gate video source readiness');

console.log('clipFxPreview.verify: shared decoder, live paused effect edits, seek/relink/retime invalidation and offthread staging passed');
