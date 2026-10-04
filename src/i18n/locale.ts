// Language status + t(): The original Chinese text is the key (no additional key namespace is created),
// if the active-language dictionary cannot be found, it will fall back to Chinese.
// Never go blank. Switch persistence localStorage('floade.locale'), subscription rerendering (useSyncExternalStore).
// Rules: Use useT() (subscription switching) in React components; pure helper modules can directly import { t }
//  — As long as the component that renders its output calls useT(), it will be recalculated when switching languages.
// LLM interface (systemPrompt/tool ​​description/skill content) and persistent dynamic history tags do not enter i18n.
// The saved choice wins; Floade prefers Traditional Chinese on a fresh install.
import { useSyncExternalStore } from 'react';
import { ensureLocaleDict, localeDictReady, localeDicts } from './dictRegistry';
import { toTraditionalUi } from './traditional';
import { productCopy } from '../branding';

export { ensureLocaleDict } from './dictRegistry';

export type Locale = 'zh-TW' | 'zh' | 'en' | 'it' | 'ru';

export const ALL_LOCALES: readonly Locale[] = ['zh-TW', 'en', 'zh', 'it', 'ru'];

const STORAGE_KEY = 'floade.locale';
const DOCUMENT_LANG: Record<Locale, string> = {
  'zh-TW': 'zh-Hant-TW',
  zh: 'zh-CN',
  en: 'en',
  it: 'it',
  ru: 'ru',
};

function systemLocale(): Locale {
  try {
    const tag = String(navigator.language ?? '').toLowerCase();
    if (tag.startsWith('zh')) return /hant|tw|hk|mo/.test(tag) ? 'zh-TW' : 'zh';
    if (tag.startsWith('it')) return 'it';
    if (tag.startsWith('ru')) return 'ru';
    return 'zh-TW';
  } catch {
    return 'zh-TW';
  }
}

function readInitial(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ALL_LOCALES.includes(stored as Locale)) return stored as Locale;
  } catch {
    // Private mode / storage disabled → system language below.
  }
  // Floade starts in Traditional Chinese; later explicit selections persist.
  const preferred = systemLocale();
  return preferred === 'zh' ? 'zh-TW' : preferred;
}

let current: Locale = readInitial();
if (typeof document !== 'undefined') document.documentElement.lang = DOCUMENT_LANG[current];
const subscribers = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

/** Subscribe to locale switches; returns the unsubscribe function. */
export function subscribeLocale(onChange: () => void): () => void {
  subscribers.add(onChange);
  return () => { subscribers.delete(onChange); };
}

export function localeLanguageName(locale: Locale): 'Traditional Chinese' | 'Chinese' | 'English' | 'Italian' | 'Russian' {
  if (locale === 'zh-TW') return 'Traditional Chinese';
  if (locale === 'zh') return 'Chinese';
  if (locale === 'it') return 'Italian';
  if (locale === 'ru') return 'Russian';
  return 'English';
}

export function localizedCatalogText(
  english: string,
  chinese: string,
  locale: Locale = current,
): string {
  return locale === 'zh-TW' ? toTraditionalUi(chinese) : locale === 'zh' ? chinese : english;
}

function notifySubscribers(): void {
  subscribers.forEach((notify) => notify());
}

export function setLocale(next: Locale): void {
  if (next === current) return;
  const alreadyLoaded = localeDictReady(next);
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch { /* If the private mode cannot be saved, it will only affect this session */ }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = DOCUMENT_LANG[next];
  }
  // Switch the UI now — an unloaded dictionary renders the Chinese original
  // rather than nothing — then re-render once the dictionary lands. In practice
  // prefetchLocaleDicts() has already loaded it and no second pass happens.
  notifySubscribers();
  if (!alreadyLoaded) void ensureLocaleDict(next).then(notifySubscribers);
}

/**
 * Warm the dictionaries the user has not selected, so switching language is
 * instant. Call after the first paint — never before, it competes with it.
 */
export function prefetchLocaleDicts(): void {
  for (const locale of ALL_LOCALES) {
    if (locale !== current) void ensureLocaleDict(locale);
  }
}

/** t('Selected {n}', { n: 3 }) - The Chinese original text is the key; the placeholder {name} has the same name in both languages. */
export function t(zh: string, params?: Record<string, string | number>): string {
  const { ui, uiFallback } = localeDicts(current);
  const translated = productCopy(ui[zh] ?? uiFallback[zh] ?? zh);
  const raw = current === 'zh-TW' ? toTraditionalUi(translated) : translated;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

/** Two-way data localization: **data** names (template names, etc.) are displayed according to the current language in the table lookup. If not found, they are returned as they are.
 * English key data (211 built-in items) zh state walking ZH_DATA; Chinese key data (self-made package) en state walking EN_DATA.
 * It is only used for display and does not change the data itself (the name is also a reference key). */
export function tData(text: string): string {
  const { data, dataFallback } = localeDicts(current);
  const translated = data[text] ?? dataFallback[text];
  if (translated === undefined) return text;
  return current === 'zh-TW' ? toTraditionalUi(translated) : translated;
}

/** Get t in the component: subscribe to language switching, trigger rerendering of this component when switching. */
export function useT(): typeof t {
  useSyncExternalStore(
    (onChange) => {
      subscribers.add(onChange);
      return () => subscribers.delete(onChange);
    },
    () => current,
  );
  return t;
}
