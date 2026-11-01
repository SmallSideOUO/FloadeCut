import assert from 'node:assert/strict';
import { CURRENT_PROJECT_VERSION } from '../../shared/project-version';
import { compoundClips, uncompoundClips } from './compoundClips';
import { activeTimeline, type ProjectDoc, type TimelineItem } from './types';
import { historyReduce } from './reduce';
import { buildCommands } from './storeCommandBuilder';
import { runProjectMigrations } from '../persist/migrations';

const clip = (id: string, startFrame: number, track = 'lane-main'): TimelineItem => ({
  id, name: id, kind: 'video', src: `/${id}.mp4`, startFrame, track, durationInFrames: 30, srcInFrame: 12,
  effects: [{ id: `fx-${id}`, assetId: 'builtin:fx-local-mosaic' }],
});
const base: ProjectDoc = { version: CURRENT_PROJECT_VERSION, assets: [], mediaFolders: [], activeTimelineId: 'main', timelines: [{
  id: 'main', name: 'Main', order: 0, width: 640, height: 360, fps: 30, fit: 'contain',
  selectedId: 'b', selectedIds: ['a', 'b'], items: [clip('a', 30), clip('b', 90), clip('rest', 180)],
  trackOrder: ['lane-upper', 'lane-main', 'lane-audio'], tracks: { 'lane-upper': { kind: 'video' }, 'lane-main': { kind: 'video' }, 'lane-audio': { kind: 'audio' } },
}] };
const merged = compoundClips(base, ['a', 'b'], 'Compound');
assert.ok(merged.ok);
const parent = activeTimeline(merged.doc);
const wrapper = parent.items.find((item) => item.compound)!;
const child = merged.doc.timelines.find((timeline) => timeline.id === wrapper.timelineId)!;
assert.equal(wrapper.startFrame, 30);
assert.equal(wrapper.durationInFrames, 90, 'gaps are preserved');
assert.equal(parent.items.length, 2);
assert.equal(child.hidden, true);
assert.equal(merged.doc.activeTimelineId, 'main');
assert.deepEqual(child.items.map((item) => [item.id, item.startFrame, item.srcInFrame]), [['a', 0, 12], ['b', 60, 12]]);
const persisted = runProjectMigrations(JSON.parse(JSON.stringify(merged.doc)));
assert.ok(persisted);
const roundTrip = uncompoundClips(persisted.doc, [wrapper.id]);
assert.ok(roundTrip.ok);
assert.equal(roundTrip.doc.timelines.length, 1);
assert.deepEqual(activeTimeline(roundTrip.doc).items.sort((a, b) => a.startFrame - b.startFrame), activeTimeline(base).items);
assert.equal(activeTimeline(base).items.length, 3, 'the input is never mutated');

let history = { past: [] as ProjectDoc[], present: base, future: [] as ProjectDoc[] };
const commands = buildCommands((action) => { history = historyReduce(history, action); }, () => history.present);
assert.ok(commands.compoundClips(['a', 'b'], 'Compound').ok);
assert.equal(history.past.length, 1);
commands.undo();
assert.equal(history.present, base);
commands.redo();
const live = activeTimeline(history.present).items.find((item) => item.compound)!;
commands.setItemEffects(live.id, [{ id: 'mask', assetId: 'builtin:fx-local-mosaic' }]);
assert.ok(commands.uncompoundClips([live.id]).ok);
assert.equal(activeTimeline(history.present).items.find((item) => item.id === 'a')!.effects![0].id, 'fx-a');
commands.undo();
assert.equal(activeTimeline(history.present).items.find((item) => item.id === live.id)!.effects![0].id, 'mask');

const trimmed = structuredClone(merged.doc);
Object.assign(activeTimeline(trimmed).items.find((item) => item.compound)!, { startFrame: 200, srcInFrame: 10, durationInFrames: 70 });
const dissolved = uncompoundClips(trimmed, [wrapper.id]);
assert.ok(dissolved.ok);
const a = activeTimeline(dissolved.doc).items.find((item) => item.id === 'a')!;
const b = activeTimeline(dissolved.doc).items.find((item) => item.id === 'b')!;
assert.deepEqual([a.startFrame, a.durationInFrames, a.srcInFrame], [200, 20, 22]);
assert.deepEqual([b.startFrame, b.durationInFrames, b.srcInFrame], [250, 20, 12]);

const multiTrack = structuredClone(base);
activeTimeline(multiTrack).items[0].track = 'lane-upper';
activeTimeline(multiTrack).tracks!['lane-upper']!.muted = true;
const multi = compoundClips(multiTrack, ['a', 'b'], 'Compound');
assert.ok(multi.ok);
const multiWrapper = activeTimeline(multi.doc).items.find((item) => item.compound)!;
assert.equal(activeTimeline(multi.doc).tracks![multiWrapper.track]!.muted, undefined, 'container must not mute an unmuted child');
const multiRestored = uncompoundClips(multi.doc, [multiWrapper.id]);
assert.ok(multiRestored.ok);
assert.equal(activeTimeline(multiRestored.doc).items.find((item) => item.id === 'a')!.track, 'lane-upper');

const withGapClip = structuredClone(base);
activeTimeline(withGapClip).items.push(clip('gap', 60));
const gapMerge = compoundClips(withGapClip, ['a', 'b'], 'Compound');
assert.ok(gapMerge.ok);
assert.notEqual(activeTimeline(gapMerge.doc).items.find((item) => item.compound)!.track, 'lane-main');
assert.ok(activeTimeline(gapMerge.doc).items.some((item) => item.id === 'gap'));

const collision = structuredClone(merged.doc);
activeTimeline(collision).items.push(clip('a', 30));
const safe = uncompoundClips(collision, [wrapper.id]);
assert.ok(safe.ok);
const restoredItems = activeTimeline(safe.doc).items;
assert.equal(new Set(restoredItems.map((item) => item.id)).size, restoredItems.length);
assert.equal(restoredItems.filter((item) => item.startFrame === 30).length, 2);
assert.equal(new Set(restoredItems.filter((item) => item.startFrame === 30).map((item) => item.track)).size, 2);

const locked = structuredClone(base);
activeTimeline(locked).tracks!['lane-main']!.locked = true;
assert.equal(compoundClips(locked, ['a', 'b'], 'Compound').ok, false);
const fast = structuredClone(merged.doc);
activeTimeline(fast).items.find((item) => item.compound)!.playbackRate = 2;
assert.equal(uncompoundClips(fast, [wrapper.id]).ok, false);
assert.equal(compoundClips(base, ['a'], 'Compound').ok, false);
const adjacent = structuredClone(base);
activeTimeline(adjacent).items[1].startFrame = 60;
activeTimeline(adjacent).transitions = [{ id: 'dissolve', type: 'cross-dissolve', trackId: 'lane-main', outgoingItemId: 'a', incomingItemId: 'b', durationInFrames: 10 }];
activeTimeline(adjacent).linkGroups = [{ id: 'linked', mode: 'linked', itemIds: ['a', 'b'], anchorItemId: 'a' }];
assert.equal(compoundClips(adjacent, ['a', 'rest'], 'Compound').ok, false, 'partial relationships cannot be lost');
const adjacentMerge = compoundClips(adjacent, ['a', 'b'], 'Compound');
assert.ok(adjacentMerge.ok);
const adjacentWrapper = activeTimeline(adjacentMerge.doc).items.find((item) => item.compound)!;
activeTimeline(adjacentMerge.doc).items.push({ ...clip('collision', 30), durationInFrames: 60 });
const adjacentRestored = uncompoundClips(adjacentMerge.doc, [adjacentWrapper.id]);
assert.ok(adjacentRestored.ok);
assert.equal(activeTimeline(adjacentRestored.doc).transitions?.length, 1);
assert.equal(activeTimeline(adjacentRestored.doc).transitions![0].trackId, activeTimeline(adjacentRestored.doc).items.find((item) => item.id === 'a')!.track);
assert.deepEqual(activeTimeline(adjacentRestored.doc).linkGroups![0].itemIds, ['a', 'b']);
const captions = structuredClone(base);
activeTimeline(captions).captions = { enabled: true, template: 'plain', pacing: 'word', sourceItemId: 'a' };
assert.equal(compoundClips(captions, ['a', 'b'], 'Compound').ok, false, 'caption source bindings cannot be silently broken');
console.log('compoundClips.verify: reversible nesting, source windows, history, effects, track states, collisions and guards passed');
