import { useId, type ReactNode } from 'react';
import type { ClipEffect } from './types';
import { SEQUENCE_MOSAIC_ID, sequenceMosaicParams } from './sequenceMosaicParams';

/** SVG filters sample the composited sequence itself, including transforms, text and transitions.
 * Chromium uses the same primitives in the player and frame-by-frame desktop exports. */
function MosaicPass({ effect, width, height, children }: { effect: ClipEffect; width: number; height: number; children: ReactNode }) {
  const id = `sequence-mosaic-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const p = sequenceMosaicParams(effect, width, height);
  if (!p.width || !p.height || p.block <= 1) return children;
  // Sample a one-pixel dot at each block centre, then expand it into a solid square.
  const half = (p.block - 1) / 2;
  return <>
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <defs>
        <filter id={id} x="0" y="0" width={width} height={height} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood x={half} y={half} width="1" height="1" floodColor="white" result="dot" />
          <feComposite in="dot" in2="dot" operator="over" x="0" y="0" width={p.block} height={p.block} result="cell" />
          <feTile in="cell" x="0" y="0" width={width} height={height} result="grid" />
          <feComposite in="SourceGraphic" in2="grid" operator="in" result="samples" />
          <feMorphology in="samples" operator="dilate" radius={Math.ceil(half)} result="pixels" />
          <feFlood x={p.x + p.feather / 2} y={p.y + p.feather / 2} width={Math.max(0, p.width - p.feather)} height={Math.max(0, p.height - p.feather)} floodColor="white" result="box" />
          <feGaussianBlur in="box" stdDeviation={p.feather / 3} x="0" y="0" width={width} height={height} result="mask" />
          <feComposite in="pixels" in2="mask" operator="in" result="mosaic" />
          <feComposite in="SourceGraphic" in2="mask" operator="out" result="outside" />
          <feComposite in="mosaic" in2="outside" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>
      </defs>
    </svg>
    <div style={{ position: 'absolute', inset: 0, filter: `url(#${id})` }}>{children}</div>
  </>;
}

export function SequenceMosaic({ effects, width, height, children }: { effects: ClipEffect[] | undefined; width: number; height: number; children: ReactNode }) {
  return (effects ?? []).filter((effect) => effect.assetId === SEQUENCE_MOSAIC_ID).reduce<ReactNode>(
    (content, effect) => <MosaicPass key={effect.id} effect={effect} width={width} height={height}>{content}</MosaicPass>, children,
  );
}
