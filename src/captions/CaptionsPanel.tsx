import { useEffect, useState, type RefObject } from 'react';
import type { PlayerRef } from '@remotion/player';
import type { TimelineItem, TrackId } from '../editor/types';
import { useT } from '../i18n/locale';
import { trackTitle, type TranscriptTrackOption } from '../transcript/trackOptions';
import { msToFrame } from '../transcript/types';
import { CaptionsControls } from './CaptionsControls';
import { newManualCaptions } from './manualCaptions';
import type { CaptionsData } from './types';

interface Props {
  playerRef: RefObject<PlayerRef | null>;
  fps: number;
  items: TimelineItem[];
  captionTracks: Array<TranscriptTrackOption & { captions: CaptionsData | null }>;
  onSetCaptions: (captions: CaptionsData | null, track?: TrackId) => void;
  onUpdateCaptions: (patch: Partial<CaptionsData>, track?: TrackId) => void;
}

export function CaptionsPanel(props: Props) {
  const { playerRef, fps, items, captionTracks, onSetCaptions, onUpdateCaptions } = props;
  const [captionTrack, setCaptionTrack] = useState<TrackId | null>(captionTracks[0]?.id ?? null);
  const captions = captionTracks.find((option) => option.id === captionTrack)?.captions ?? null;
  useEffect(() => {
    if (!captionTrack || !captionTracks.some((option) => option.id === captionTrack)) setCaptionTrack(captionTracks[0]?.id ?? null);
  }, [captionTrack, captionTracks]);
  const update = (patch: Partial<CaptionsData>) => onUpdateCaptions(patch, captionTrack ?? undefined);
  const set = (next: CaptionsData | null) => onSetCaptions(next, captionTrack ?? undefined);
  return (
    <div className="cc-captions-workspace">
      <div className="cc-captions-context">
        <CaptionTrackBar options={captionTracks} track={captionTrack} onChange={setCaptionTrack} />
      </div>
      <CaptionsControls captionTrackId={captionTrack ?? undefined} captions={captions} sourceVariants={(captions?.sourceItemId ? items.find((item) => item.id === captions.sourceItemId)?.variants : undefined) ?? []} items={items} fps={fps} onSeekMs={(ms) => playerRef.current?.seekTo(msToFrame(ms, fps))} onCreateManual={() => set(newManualCaptions())} getPlayheadMs={() => ((playerRef.current?.getCurrentFrame() ?? 0) / fps) * 1000} onUpdate={update} onRemove={() => set(null)} />
    </div>
  );
}

function CaptionTrackBar({ options, track, onChange }: { options: Props['captionTracks']; track: TrackId | null; onChange: (track: TrackId) => void }) {
  const t = useT();
  return (
    <div className="cc-captions-sourcebar">
      <label htmlFor="cc-caption-track">{t('字幕轨道')}</label>
      <select id="cc-caption-track" className="cc-cap-select" value={track ?? ''} disabled={!options.length} onChange={(event) => onChange(event.target.value)}>
        {!options.length && <option value="">{t('请先新建字幕轨道')}</option>}
        {options.map((option) => <option key={option.id} value={option.id}>{trackTitle(option)}</option>)}
      </select>
    </div>
  );
}
