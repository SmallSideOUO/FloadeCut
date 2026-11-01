import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ClipEffect, TimelineState } from '../../editor/types';
import { t } from '../../i18n/locale';
import {
  LOCAL_MOSAIC_ID, mosaicRect, mosaicToPreview, moveMosaicRect, patchMosaicRect, previewToMosaic,
  type MosaicHandle,
} from './localMosaic';
import { previewPointerFromClient, type PreviewCandidate, type PreviewPoint, type PreviewRect } from './previewTransform';

interface Props {
  state: TimelineState;
  candidate: PreviewCandidate;
  onChange: (id: string, effects: ClipEffect[]) => void;
  onPause: () => void;
  onBeginHistoryGesture: () => void;
  onEndHistoryGesture: () => void;
}

interface Gesture {
  pointerId: number;
  effectId: string;
  handle: MosaicHandle;
  candidate: PreviewCandidate;
  rect: PreviewRect;
  start: PreviewPoint;
  client: PreviewPoint;
  moved: boolean;
}

const HANDLES = [
  ['nw', 0, 0], ['n', 0.5, 0], ['ne', 1, 0], ['e', 1, 0.5],
  ['se', 1, 1], ['s', 0.5, 1], ['sw', 0, 1], ['w', 0, 0.5],
] as const;

export function PreviewMosaicOverlay(props: Props) {
  const { state, candidate } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef(props);
  latestRef.current = props;
  const gestureRef = useRef<Gesture | null>(null);
  const pendingRef = useRef<PreviewRect | null>(null);
  const rafRef = useRef(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const effects = (candidate.item.effects ?? []).filter((effect) => effect.assetId === LOCAL_MOSAIC_ID);
  const selectedId = effects.some((effect) => effect.id === activeId) ? activeId : effects.at(-1)?.id;

  const commit = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    const gesture = gestureRef.current;
    const rect = pendingRef.current;
    pendingRef.current = null;
    if (!gesture || !rect) return;
    const latest = latestRef.current;
    const current = latest.state.items.find((item) => item.id === gesture.candidate.item.id);
    if (!current?.effects?.some((effect) => effect.id === gesture.effectId)) return;
    latest.onChange(current.id, patchMosaicRect(current.effects, gesture.effectId, rect));
  };

  const finish = () => {
    if (!gestureRef.current) return;
    commit();
    gestureRef.current = null;
    latestRef.current.onEndHistoryGesture();
  };

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (gestureRef.current) latestRef.current.onEndHistoryGesture();
  }, []);

  const begin = (event: ReactPointerEvent, effect: ClipEffect, handle: MosaicHandle) => {
    if (event.button !== 0 || gestureRef.current || !rootRef.current) return;
    event.stopPropagation();
    event.preventDefault();
    props.onPause();
    setActiveId(effect.id);
    const client = { x: event.clientX, y: event.clientY };
    const { composition: point } = previewPointerFromClient(client, rootRef.current.getBoundingClientRect(), state);
    gestureRef.current = {
      pointerId: event.pointerId, effectId: effect.id, handle, candidate, rect: mosaicRect(effect),
      start: previewToMosaic(state, candidate, point), client, moved: false,
    };
    rootRef.current.setPointerCapture(event.pointerId);
    props.onBeginHistoryGesture();
  };

  const update = (event: ReactPointerEvent) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId || !rootRef.current) return;
    event.stopPropagation();
    if (!gesture.moved && Math.hypot(event.clientX - gesture.client.x, event.clientY - gesture.client.y) < 3) return;
    gesture.moved = true;
    const bounds = rootRef.current.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const start = mosaicToPreview(state, gesture.candidate, gesture.start);
    const point = {
      x: start.x + (event.clientX - gesture.client.x) / bounds.width * state.width,
      y: start.y + (event.clientY - gesture.client.y) / bounds.height * state.height,
    };
    const local = previewToMosaic(state, gesture.candidate, point);
    pendingRef.current = moveMosaicRect(gesture.rect, { x: local.x - gesture.start.x, y: local.y - gesture.start.y }, gesture.handle);
    if (!rafRef.current) rafRef.current = requestAnimationFrame(commit);
  };

  const percent = (point: PreviewPoint) => ({ left: `${point.x / state.width * 100}%`, top: `${point.y / state.height * 100}%` });

  return (
    <div ref={rootRef} className="cc-preview-mosaic-overlay" role="group" aria-label={t('局部马赛克区域')}
      onPointerMove={update}
      onPointerUp={(event) => {
        if (gestureRef.current?.pointerId !== event.pointerId) return;
        update(event);
        event.stopPropagation();
        finish();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={(event) => { event.stopPropagation(); finish(); }}
      onLostPointerCapture={() => finish()}
    >
      {effects.map((effect, index) => {
        const rect = mosaicRect(effect);
        const project = (x: number, y: number) => mosaicToPreview(state, candidate, { x: rect.x + x * rect.width, y: rect.y + y * rect.height });
        const corners = [project(0, 0), project(1, 0), project(1, 1), project(0, 1)];
        const active = effect.id === selectedId;
        return (
          <div key={effect.id} className={`cc-preview-mosaic-region${active ? ' active' : ''}`}>
            <svg className="cc-preview-mosaic-outline" viewBox={`0 0 ${state.width} ${state.height}`} preserveAspectRatio="none" aria-hidden="true">
              <polygon data-mosaic-region={effect.id} points={corners.map((point) => `${point.x},${point.y}`).join(' ')}
                vectorEffect="non-scaling-stroke" onPointerDown={(event) => begin(event, effect, 'move')} />
            </svg>
            <button type="button" className="cc-preview-mosaic-label" style={percent(corners[0])}
              aria-label={t('移动马赛克区域 {n}', { n: index + 1 })}
              onPointerDown={(event) => begin(event, effect, 'move')}
              onClick={(event) => { event.stopPropagation(); setActiveId(effect.id); }}
            >{t('马赛克 {n}', { n: index + 1 })}</button>
            {active && HANDLES.map(([handle, x, y]) => (
              <button key={handle} type="button" data-mosaic-handle={handle}
                className={`cc-preview-transform-handle cc-preview-mosaic-handle cc-preview-mosaic-${handle}`}
                style={percent(project(x, y))} aria-label={t('调整马赛克区域 {n} 大小', { n: index + 1 })}
                onPointerDown={(event) => begin(event, effect, handle)} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
