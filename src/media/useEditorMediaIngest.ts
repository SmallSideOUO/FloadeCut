import { useCallback } from 'react';
import { appendManualLane, identifyManualCues, isManualCaptionEntry, newManualCaptions } from '../captions/manualCaptions';
import { placeMediaAssets, reflowPlacedMediaItems } from '../editor/mediaAssetPlacement';
import { isTimelineMediaAssetKind } from '../editor/mediaTypes';
import type { EditorCommands } from '../editor/store';
import { captionsOnTrack, defaultTrackId, trackKind, type MediaAsset, type ProjectDoc, type TimelineState, type TrackId } from '../editor/types';
import type { t as translate } from '../i18n/locale';
import { duplicateAssetName } from './assetMenuSelection';
import { classifyExternalFile, parseDroppedCaptions } from './externalFileDrop';
import { createImportContentIdentityHooks } from './importContentIdentity';
import { mediaAssetRelinkPatch, uploadedMediaRelinkPatch } from './mediaAssetRelink';
import { importUploadedMedia } from './mobileImport';
import { importAssetToPool, type ImportLifecycle, type StartAssetTranscription } from './poolImportRun';
import type { MobileUploadRecord } from './mobileUploadApi';
import { importMedia, readyMediaAssetsForPaste, type ImportMediaHooks } from './upload';
import { showAppToast } from '../ui/appToast';

type Translate = typeof translate;
type ImportToPool = (file: File, onProgress?: (ratio: number) => void, lifecycle?: ImportLifecycle) => Promise<MediaAsset>;
interface PoolImports {
  ingestToPool: (asset: MediaAsset, durationFps?: number) => void;
  importMobileUpload: (record: MobileUploadRecord) => Promise<void>;
  importToPool: ImportToPool;
}

interface EditorMediaIngestOptions {
  commands: EditorCommands;
  projectId: string;
  assets: MediaAsset[];
  stateRef: { current: TimelineState };
  docRef: { current: ProjectDoc };
  getPlayhead: () => number;
  t: Translate;
}

interface PlacedItem {
  assetId: string;
  itemId: string;
  kind: 'video' | 'audio';
  startFrame: number;
  durationInFrames: number;
  autoManaged: boolean;
  pendingAutoWrite?: { fromStartFrame: number; toStartFrame: number };
}

interface DropBatch {
  batchStartFrame: number;
  placedItems: PlacedItem[];
  stoppedReflowKinds: Set<'video' | 'audio'>;
  pendingDurations: Map<string, number>;
}

interface DropContext {
  commands: EditorCommands;
  stateRef: { current: TimelineState };
  startAssetTranscription: StartAssetTranscription;
  t: Translate;
}

function nextStartForKind(batch: DropBatch, kind: 'video' | 'audio'): number {
  return batch.placedItems
    .filter((item) => item.kind === kind)
    .reduce(
      (frame, item) => frame + Math.max(1, item.durationInFrames),
      batch.batchStartFrame,
    );
}

function stopAutoReflowFrom(batch: DropBatch, kind: 'video' | 'audio', itemId: string): void {
  let stop = false;
  for (const candidate of batch.placedItems) {
    if (candidate.kind !== kind) continue;
    if (candidate.itemId === itemId) stop = true;
    if (!stop) continue;
    candidate.autoManaged = false;
    delete candidate.pendingAutoWrite;
  }
  batch.stoppedReflowKinds.add(kind);
}

function reconcilePlacedItem(batch: DropBatch, item: PlacedItem, placementStartFrame: number, context: DropContext): void {
  const live = context.stateRef.current.items.find((candidate) => candidate.id === item.itemId);
  if (!live) return stopAutoReflowFrom(batch, item.kind, item.itemId);
  const pending = item.pendingAutoWrite;
  if (live.startFrame === item.startFrame) delete item.pendingAutoWrite;
  else if (!pending || pending.toStartFrame !== item.startFrame
    || live.startFrame !== pending.fromStartFrame) {
    stopAutoReflowFrom(batch, item.kind, item.itemId);
    return;
  }
  if (item.startFrame === placementStartFrame) return;
  const fromStartFrame = item.pendingAutoWrite?.fromStartFrame ?? live.startFrame;
  item.startFrame = placementStartFrame;
  item.pendingAutoWrite = { fromStartFrame, toStartFrame: placementStartFrame };
  context.commands.setItemTiming(item.itemId, { startFrame: placementStartFrame });
}

function reflowPlacedBatch(batch: DropBatch, context: DropContext): void {
  for (const placement of reflowPlacedMediaItems(batch.placedItems, batch.batchStartFrame)) {
    const item = batch.placedItems.find((candidate) => candidate.itemId === placement.itemId);
    if (item?.autoManaged) reconcilePlacedItem(batch, item, placement.startFrame, context);
  }
}

function updatePlacedAsset(batch: DropBatch, asset: MediaAsset, context: DropContext): void {
  batch.pendingDurations.set(asset.id, asset.durationInFrames);
  const item = batch.placedItems.find((candidate) => candidate.assetId === asset.id);
  if (!item) return;
  item.durationInFrames = Math.max(1, asset.durationInFrames);
  reflowPlacedBatch(batch, context);
}

function removePlacedAsset(batch: DropBatch, assetId: string, context: DropContext): void {
  const index = batch.placedItems.findIndex((candidate) => candidate.assetId === assetId);
  if (index < 0) return;
  const [{ itemId }] = batch.placedItems.splice(index, 1);
  context.commands.removeItem(itemId);
  context.commands.removeMediaAsset(assetId);
  reflowPlacedBatch(batch, context);
}

function timelineImportHooks(batch: DropBatch, context: DropContext, placeholder: { id: string | null }, resolve: (asset: MediaAsset) => void): ImportMediaHooks {
  return {
    ...createImportContentIdentityHooks({
      getAssets: () => context.stateRef.current.assets ?? [],
      onCanonical: (canonical, duplicateId) => {
        const placement = batch.placedItems.find((candidate) => candidate.assetId === duplicateId);
        if (placement) placement.assetId = canonical.id;
        context.commands.canonicalizeMediaAsset(duplicateId, canonical.id);
        updatePlacedAsset(batch, canonical, context);
      },
    }),
    onPlaceholder: (asset, durationFps) => {
      placeholder.id = asset.id;
      context.commands.addAsset(asset, durationFps);
      resolve(asset);
    },
    onUploaded: (info) => {
      context.commands.relinkMediaAsset(info.id, uploadedMediaRelinkPatch(info));
      context.startAssetTranscription(info, info.asrPath);
    },
    onReady: (asset, durationFps) => {
      context.commands.relinkMediaAsset(asset.id, mediaAssetRelinkPatch(asset, durationFps));
      updatePlacedAsset(batch, asset, context);
    },
  };
}

function awaitTimelinePlaceholder(file: File, batch: DropBatch, context: DropContext): Promise<MediaAsset> {
  const { promise, resolve, reject } = Promise.withResolvers<MediaAsset>();
  const placeholder = { id: null as string | null };
  void importMedia(
    file,
    context.stateRef.current.fps,
    timelineImportHooks(batch, context, placeholder, resolve),
  ).catch((error) => {
    if (!placeholder.id) reject(error);
    else removePlacedAsset(batch, placeholder.id, context);
    showAppToast(error instanceof Error ? error.message : context.t('导入失败'), { error: true });
  });
  return promise;
}

async function importDroppedCaptions(file: File, trackId: TrackId, startFrame: number, context: DropContext): Promise<void> {
  try {
    const snapshot = context.stateRef.current;
    const captionTrackId = trackKind(snapshot, trackId) === 'caption'
      ? trackId
      : defaultTrackId(snapshot, 'caption');
    if (!captionTrackId) throw new Error(context.t('请先创建字幕轨道'));
    const words = identifyManualCues(parseDroppedCaptions(
      file.name,
      await file.text(),
      Math.max(0, startFrame) * 1000 / snapshot.fps,
    ));
    if (!words.length) throw new Error(context.t('字幕文件没有可用内容'));
    const current = captionsOnTrack(snapshot, captionTrackId) ?? newManualCaptions();
    const withLane = current.sourceEntries?.some(isManualCaptionEntry)
      ? current
      : { ...current, ...appendManualLane(current, snapshot.items) };
    const lane = withLane.sourceEntries?.find(isManualCaptionEntry);
    if (!lane) throw new Error(context.t('无法创建字幕轨道'));
    context.commands.setCaptions({
      ...withLane,
      enabled: true,
      sourceEntries: withLane.sourceEntries?.map((entry) => entry.id === lane.id
        ? { ...entry, words: [...(entry.words ?? []), ...words] }
        : entry),
    }, captionTrackId);
  } catch (error) {
    showAppToast(error instanceof Error ? error.message : context.t('读取字幕文件失败'), { error: true });
  }
}

async function placeDroppedMedia(file: File, mediaKind: MediaAsset['kind'], trackId: TrackId, batch: DropBatch, context: DropContext): Promise<string | null> {
  try {
    const asset = await awaitTimelinePlaceholder(file, batch, context);
    const kind = mediaKind === 'audio' ? 'audio' : 'video';
    const snapshot = context.stateRef.current;
    const destination = trackKind(snapshot, trackId) === kind
      ? trackId
      : defaultTrackId(snapshot, kind);
    const itemStartFrame = nextStartForKind(batch, kind);
    const itemId = context.commands.addMediaItem(asset, {
      track: destination ?? undefined,
      startFrame: itemStartFrame,
    });
    batch.placedItems.push({
      assetId: asset.id,
      itemId,
      kind,
      startFrame: itemStartFrame,
      durationInFrames: batch.pendingDurations.get(asset.id) ?? asset.durationInFrames,
      autoManaged: !batch.stoppedReflowKinds.has(kind),
    });
    return itemId;
  } catch (error) {
    showAppToast(error instanceof Error ? error.message : context.t('导入失败'), { error: true });
    return null;
  }
}

async function dropFilesToTimeline(files: File[], trackId: TrackId, startFrame: number, context: DropContext): Promise<void> {
  const batch: DropBatch = {
    batchStartFrame: Math.max(0, Math.round(startFrame)),
    placedItems: [],
    stoppedReflowKinds: new Set(),
    pendingDurations: new Map(),
  };
  const addedIds: string[] = [];
  for (const file of files) {
    const target = classifyExternalFile(file);
    if (!target) {
      showAppToast(context.t('不支持导入「{name}」', { name: file.name }), { error: true });
    } else if (target.type === 'caption') {
      await importDroppedCaptions(file, trackId, startFrame, context);
    } else {
      const itemId = await placeDroppedMedia(file, target.mediaKind, trackId, batch, context);
      if (itemId) addedIds.push(itemId);
    }
  }
  if (addedIds.length) context.commands.selectItems(addedIds);
}

function usePoolImports(options: EditorMediaIngestOptions, start: StartAssetTranscription): PoolImports {
  const { commands, stateRef, t } = options;
  const ingestToPool = useCallback((asset: MediaAsset, durationFps?: number) => {
    commands.addAsset(asset, durationFps);
  }, [commands]);
  const importMobileUpload = useCallback(async (record: MobileUploadRecord) => {
    const fps = stateRef.current.fps;
    ingestToPool(await importUploadedMedia(record, fps), fps);
  }, [ingestToPool, stateRef]);
  const importToPool = useCallback((
    file: File,
    onProgress?: (ratio: number) => void,
    lifecycle?: ImportLifecycle,
  ) => importAssetToPool(
    file, onProgress, lifecycle, { commands, stateRef, t }, start,
  ), [commands, start, stateRef, t]);
  return { ingestToPool, importMobileUpload, importToPool };
}

function useTimelineImports(
  options: EditorMediaIngestOptions,
  start: StartAssetTranscription,
  importToPool: ImportToPool,
) {
  const { commands, stateRef, getPlayhead, t } = options;
  const dropExternalFilesToTimeline = useCallback((files: File[], trackId: TrackId, startFrame: number) => (
    dropFilesToTimeline(files, trackId, startFrame, { commands, stateRef, startAssetTranscription: start, t })
  ), [commands, start, stateRef, t]);
  const addMediaAssetsToTimeline = useCallback((assets: MediaAsset[]) => {
    const timelineAssets = assets.filter((asset) => isTimelineMediaAssetKind(asset.kind));
    if (!timelineAssets.length) return;
    placeMediaAssets({
      assetIds: timelineAssets.map((asset) => asset.id),
      assets: timelineAssets,
      startFrame: getPlayhead(),
      add: (asset, frame) => commands.addMediaItem(asset, { startFrame: frame }),
      select: commands.selectItems,
    });
  }, [commands, getPlayhead]);
  const importToCanvas = useCallback(async (file: File, onProgress?: (ratio: number) => void) => {
    const asset = await importToPool(file, onProgress);
    commands.addMediaItem(asset);
  }, [commands, importToPool]);
  return { dropExternalFilesToTimeline, addMediaAssetsToTimeline, importToCanvas };
}

function useMediaPaste(options: EditorMediaIngestOptions) {
  const { commands, stateRef, t } = options;
  return useCallback((assets: MediaAsset[], folderId?: string) => {
    const readyAssets = readyMediaAssetsForPaste(assets, stateRef.current.assets ?? []);
    if (!readyAssets.length) return;
    commands.batch(readyAssets.map((asset) => ({
      type: 'addAsset' as const,
      asset: {
        ...asset,
        id: `asset_${crypto.randomUUID()}`,
        name: duplicateAssetName(asset.name, t('副本')),
        folderId,
      },
    })), t('粘贴素材'));
  }, [commands, stateRef, t]);
}

export function useEditorMediaIngest(options: EditorMediaIngestOptions) {
  const startAssetTranscription: StartAssetTranscription = () => {};
  const pool = usePoolImports(options, startAssetTranscription);
  const timeline = useTimelineImports(options, startAssetTranscription, pool.importToPool);
  const pasteMediaAssets = useMediaPaste(options);
  return {
    ...pool,
    ...timeline,
    pasteMediaAssets,
  };
}
