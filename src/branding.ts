export const PRODUCT_NAME = 'Floade';
export const UI_FONT = '"Segoe UI Variable", "Segoe UI", "Microsoft JhengHei", system-ui, sans-serif';

/** Product copy only. Keep upstream URLs, storage keys and project formats compatible. */
export function productCopy(text: string): string {
  return text.replaceAll('OpenChatCut', PRODUCT_NAME);
}
