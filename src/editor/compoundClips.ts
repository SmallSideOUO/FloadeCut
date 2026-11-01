import { activeTimeline, captionTrackEntries, timelineTrackIds, trackKind, type ProjectDoc, type Timeline, type TimelineItem } from './types';
import { maintainLinkGroups } from './linkGroups';
import { sequenceGraphError, sequenceReferencesTo } from './sequenceGraph';
import { splitTimelineItem } from './reducerOverwrite';
import { reconcileTransitions } from './transitionReconcile';

export type CompoundResult = { ok: true; doc: ProjectDoc; itemIds: string[] } | { ok: false; error: string };
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const overlaps = (a: TimelineItem, b: TimelineItem) => a.track === b.track
  && a.startFrame < b.startFrame + b.durationInFrames && b.startFrame < a.startFrame + a.durationInFrames;

/** Move, rather than bake, the selection into a private sequence. One project commit is one undo. */
export function compoundClips(doc: ProjectDoc, ids: readonly string[], name: string): CompoundResult {
  const parent = activeTimeline(doc);
  const selected = new Set(ids);
  const items = parent.items.filter((item) => selected.has(item.id));
  if (items.length < 2) return { ok: false, error: '请先选择两个或以上片段。' };
  if (items.some((item) => parent.tracks?.[item.track]?.locked)) return { ok: false, error: '请先解锁所选片段的轨道。' };
  if (parent.linkGroups?.some((group) => group.itemIds.some((id) => selected.has(id)) && !group.itemIds.every((id) => selected.has(id)))) {
    return { ok: false, error: '请一并选择链接或同步锁定组的所有片段，或先取消链接。' };
  }
  // Do not silently detach caption streams from source ids that are about to move into a sequence.
  if ([parent.captions, ...captionTrackEntries(parent).map(({ captions }) => captions)].some((captions) => captions && (
    (captions.sourceMode === 'timeline' && items.some((item) => item.transcript?.length))
    || (captions.sourceItemId && selected.has(captions.sourceItemId))
    || captions.sources?.some((id) => selected.has(id))
    || captions.sourceEntries?.some((entry) => !entry.words && selected.has(entry.itemId))
  ))) return { ok: false, error: '所选片段正在驱动字幕，请先将字幕转为独立字幕再合并，以保留字幕内容。' };
  if ((parent.transitions ?? []).some((tr) => selected.has(tr.incomingItemId) !== selected.has(tr.outgoingItemId))) {
    return { ok: false, error: '请一并选择转场两侧的片段，或先移除边界转场。' };
  }
  if ((parent.multicamGroups ?? []).some((group) => group.angles.some((angle) => selected.has(angle.itemId)))) {
    return { ok: false, error: '请先解除多机位组，再合并片段。' };
  }
  const start = Math.min(...items.map((item) => item.startFrame));
  const end = Math.max(...items.map((item) => item.startFrame + item.durationInFrames));
  const order = timelineTrackIds(parent);
  const visual = items.filter((item) => trackKind(parent, item.track) === 'video');
  const track = order.find((id) => visual.some((item) => item.track === id)) ?? order.find((id) => items.some((item) => item.track === id))!;
  const rest = parent.items.filter((item) => !selected.has(item.id));
  let destination = track;
  const tracks = { ...parent.tracks };
  const trackOrder = [...order];
  // A selection with gaps may surround an unselected clip. Never cover that clip in its lane.
  if (new Set(items.map((item) => item.track)).size > 1 || trackKind(parent, track) !== 'video' || rest.some((item) => overlaps(item, { ...items[0], track, startFrame: start, durationInFrames: end - start }))) {
    destination = uid('track');
    trackOrder.splice(Math.max(0, order.indexOf(track)), 0, destination);
    tracks[destination] = { kind: 'video', name };
  }
  const child: Timeline = {
    id: uid('tl'), name, order: Math.max(...doc.timelines.map((timeline) => timeline.order)) + 1, hidden: true,
    fps: parent.fps, width: parent.width, height: parent.height, fit: parent.fit,
    items: items.map((item) => ({ ...item, startFrame: item.startFrame - start })),
    trackOrder: order, tracks: Object.fromEntries(order.map((id) => [id, { ...parent.tracks?.[id], captions: null }])),
    transitions: (parent.transitions ?? []).filter((tr) => selected.has(tr.incomingItemId) && selected.has(tr.outgoingItemId)),
    linkGroups: maintainLinkGroups(parent.linkGroups, selected), fxDefs: parent.fxDefs,
    captions: null, captionsHidden: parent.captionsHidden, selectedId: null, selectedIds: [],
  };
  const compound: TimelineItem = {
    id: uid('item'), name, kind: 'sequence', timelineId: child.id, compound: true,
    track: destination, startFrame: start, durationInFrames: end - start,
    width: parent.width, height: parent.height,
  };
  const remainingIds = new Set(rest.map((item) => item.id));
  const nextParent: Timeline = {
    ...parent, items: [...rest, compound], trackOrder, tracks,
    transitions: (parent.transitions ?? []).filter((tr) => !selected.has(tr.incomingItemId) && !selected.has(tr.outgoingItemId)),
    linkGroups: maintainLinkGroups(parent.linkGroups, remainingIds),
    selectedId: compound.id, selectedIds: [compound.id],
  };
  const next = { ...doc, timelines: [...doc.timelines.map((timeline) => timeline.id === parent.id ? nextParent : timeline), child] };
  const error = sequenceGraphError(next);
  return error ? { ok: false, error: error.message } : { ok: true, doc: next, itemIds: [compound.id] };
}

/** Dissolving removes the container's effects and restores its currently visible source window. */
export function uncompoundClips(doc: ProjectDoc, ids: readonly string[]): CompoundResult {
  let next = doc;
  const restoredIds: string[] = [];
  for (const id of ids) {
    const parent = activeTimeline(next);
    const compound = parent.items.find((item) => item.id === id);
    const child = next.timelines.find((timeline) => timeline.id === compound?.timelineId);
    if (!compound?.compound || compound.kind !== 'sequence' || !child) return { ok: false, error: '所选片段不是合并片段。' };
    if (parent.tracks?.[compound.track]?.locked) return { ok: false, error: '请先解锁所选片段的轨道。' };
    const rate = compound.playbackRate ?? 1;
    // Animated nested content cannot be losslessly flattened after a speed change.
    if (rate !== 1) return { ok: false, error: '请先将合并片段恢复为 1× 速度，再取消合并。' };
    if (parent.transitions?.some((tr) => tr.incomingItemId === id || tr.outgoingItemId === id)) {
      return { ok: false, error: '请先移除合并片段的边界转场，再取消合并。' };
    }
    const sourceStart = compound.srcInFrame ?? 0;
    const sourceEnd = sourceStart + compound.durationInFrames;
    const rest = parent.items.filter((item) => item.id !== id);
    const used = new Set(rest.map((item) => item.id));
    const remap = new Map<string, string>();
    const restored = child.items.flatMap((item) => {
      const left = Math.max(sourceStart, item.startFrame);
      const right = Math.min(sourceEnd, item.startFrame + item.durationInFrames);
      if (right <= left) return [];
      let sliced = item;
      if (right < item.startFrame + item.durationInFrames) [sliced] = splitTimelineItem(child, sliced, right, uid('item'));
      if (left > item.startFrame) [, sliced] = splitTimelineItem(child, sliced, left, item.id);
      const newId = used.has(item.id) ? uid('item') : item.id;
      used.add(newId);
      remap.set(item.id, newId);
      return [{ ...sliced, id: newId, startFrame: compound.startFrame + left - sourceStart }];
    });
    const trackOrder = timelineTrackIds(parent);
    const tracks = { ...parent.tracks };
    const trackMap = new Map<string, string>();
    // If the original lanes have been reused or locked, restore onto fresh lanes in the same layer order.
    for (const track of timelineTrackIds(child)) {
      const laneItems = restored.filter((item) => item.track === track);
      if (!laneItems.length) continue;
      let destination = track;
      if (tracks[track]?.locked || laneItems.some((item) => rest.some((other) => overlaps(item, other)))) destination = uid('track');
      trackMap.set(track, destination);
      if (!trackOrder.includes(destination)) {
        trackOrder.splice(Math.max(0, trackOrder.indexOf(compound.track)), 0, destination);
        tracks[destination] = { ...child.tracks?.[track], locked: false, captions: null };
      }
    }
    const items = [...rest, ...restored.map((item) => ({ ...item, track: trackMap.get(item.track) ?? item.track }))];
    const transitions = [...(parent.transitions ?? []), ...(child.transitions ?? []).flatMap((tr) => {
      const incomingItemId = remap.get(tr.incomingItemId);
      const outgoingItemId = remap.get(tr.outgoingItemId);
      return incomingItemId && outgoingItemId ? [{ ...tr, id: uid('tr'), trackId: trackMap.get(tr.trackId) ?? tr.trackId, incomingItemId, outgoingItemId }] : [];
    })];
    const linkGroups = [...(maintainLinkGroups(parent.linkGroups, new Set(rest.map((item) => item.id))) ?? []),
      ...(child.linkGroups ?? []).flatMap((group) => {
        const itemIds = group.itemIds.flatMap((itemId) => remap.get(itemId) ? [remap.get(itemId)!] : []);
        return itemIds.length > 1 ? [{ ...group, id: uid('link'), itemIds, anchorItemId: remap.get(group.anchorItemId) ?? itemIds[0] }] : [];
      })];
    restoredIds.push(...restored.map((item) => item.id));
    const replacement = { ...parent, items, tracks, trackOrder, transitions: reconcileTransitions(items, transitions), linkGroups,
      fxDefs: { ...child.fxDefs, ...parent.fxDefs }, selectedIds: restoredIds, selectedId: restoredIds.at(-1) ?? null };
    next = { ...next, timelines: next.timelines.map((timeline) => timeline.id === parent.id ? replacement : timeline) };
    if (child.hidden && !sequenceReferencesTo(next, child.id).length) next = { ...next, timelines: next.timelines.filter((timeline) => timeline.id !== child.id) };
  }
  return { ok: true, doc: next, itemIds: restoredIds };
}
