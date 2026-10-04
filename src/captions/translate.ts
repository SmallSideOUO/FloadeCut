import type { TimelineItem } from '../editor/types';
import type { CaptionsData } from './types';
import { resolveCaptionWords } from './resolve';

// Translate the current caption phrases into `lang`, keeping each translation
// timed to its source phrase. Data model: a transcript translation VARIANT that
// shares the timeline (manage_transcript). Phrase-level (not word),
// since word order differs across languages; the variant reuses phrase timing.
/**
 * Compact digest of the timing the translation cues are pinned to. Cues store
 * absolute timeline ms; when the source is re-timed (words deleted, silence
 * compressed, clip moved) the digest changes and the translation is stale.
 */
export function captionTimingFingerprint(
  captions: CaptionsData,
  items: TimelineItem[],
  fps: number,
): string {
  const words = resolveCaptionWords(captions, items, fps);
  if (!words.length) return 'empty';
  let hash = 0;
  for (const word of words) {
    // Rounded to whole ms: sub-millisecond float noise must not read as an edit.
    hash = (Math.imul(hash, 31) + Math.round(word.start)) | 0;
    hash = (Math.imul(hash, 31) + Math.round(word.end)) | 0;
  }
  return `${words.length}:${Math.round(words[0]!.start)}:${Math.round(words[words.length - 1]!.end)}:${(hash >>> 0).toString(36)}`;
}

/** Whether stored translation cues no longer match the current caption timing.
 * Unknown (older data with no fingerprint) is NOT stale — never nag about a
 * translation this build cannot prove is out of date. */
export function isTranslationStale(
  captions: CaptionsData,
  items: TimelineItem[],
  fps: number,
): boolean {
  if (!captions.translation?.length || !captions.translationFingerprint) return false;
  return captions.translationFingerprint !== captionTimingFingerprint(captions, items, fps);
}
