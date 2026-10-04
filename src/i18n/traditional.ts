import { Converter } from 'opencc-js/cn2t';

const convert = Converter({ from: 'cn', to: 'twp' });
const cache = new Map<string, string>();

// Taiwan editing terminology, in addition to OpenCC's phrase conversion.
const TERMS: readonly [RegExp, string][] = [
  [/工程/g, '專案'], [/視頻/g, '影片'], [/音頻/g, '音訊'],
  [/時間線/g, '時間軸'], [/皮膚/g, '主題'], [/配置/g, '設定'],
  [/雲端或本地/g, '雲端或本機'], [/本地/g, '本機'],
  [/激活/g, '啟用'], [/賬戶/g, '帳戶'], [/賬號/g, '帳號'],
  [/搜索/g, '搜尋'], [/加載/g, '載入'], [/撤銷/g, '復原'],
  [/重命名/g, '重新命名'], [/轉寫/g, '轉錄'], [/默認/g, '預設'],
  [/去設定設定/g, '開啟設定'], [/組織指令碼/g, '編排腳本'],
];

/** Translate UI templates before interpolation, never filenames, user copy or subtitle content. */
export function toTraditionalUi(text: string): string {
  const cached = cache.get(text);
  if (cached !== undefined) return cached;
  let result = convert(text);
  for (const [pattern, replacement] of TERMS) result = result.replace(pattern, replacement);
  if (cache.size >= 4096) cache.clear();
  cache.set(text, result);
  return result;
}
