import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { SequenceMosaic } from './SequenceMosaic';
import { SEQUENCE_MOSAIC_ID, sequenceMosaicParams } from './sequenceMosaicParams';

const effect = { id: 'mask', assetId: SEQUENCE_MOSAIC_ID, overrides: {
  center_x: 0.4, center_y: 0.8, width_ratio: 0.5, height_ratio: 0.2, block_size: 24, feather: 4,
} };
const params = sequenceMosaicParams(effect, 1000, 500);
assert.ok(Math.abs(params.y - 50) < 1e-9, 'shader Y is converted to screen Y');
assert.deepEqual({ ...params, y: 50 }, { x: 150, y: 50, width: 500, height: 100, block: 24, feather: 4 });
const invalid = sequenceMosaicParams({ ...effect, overrides: { center_x: Number.NaN, width_ratio: -1, block_size: 999 } }, 1000, 500);
assert.equal(invalid.x, 500);
assert.equal(invalid.width, 0);
assert.equal(invalid.block, 200);
const markup = renderToStaticMarkup(<SequenceMosaic effects={[effect, { ...effect, id: 'mask2' }]} width={1000} height={500}><div>Composite content</div></SequenceMosaic>);
assert.equal((markup.match(/<filter /g) ?? []).length, 2, 'multiple independent regions are chained');
assert.equal(new Set([...markup.matchAll(/<filter id="([^"]+)"/g)].map((match) => match[1])).size, 2, 'each region has a distinct filter id');
assert.ok(markup.includes('feTile') && markup.includes('feMorphology'));
assert.ok(markup.includes('Composite content'));
console.log('sequenceMosaic.verify: bounds, screen coordinates and independent stacked masks passed');
