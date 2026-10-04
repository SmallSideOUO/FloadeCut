// General editor and storage preferences. No model credentials or provider configuration.
import { readFile } from 'node:fs/promises';
import { atomicWriteFile } from './plugins/project-store-durable.ts';
import { mergeEnvText } from './env-text.ts';
export { mergeEnvText } from './env-text.ts';
import { isIsolatedDevProfile, runtimeProfile } from './runtime-profile.ts';
import { KEY_NAMES, type KeyName } from './keystore-names.ts';
export { KEY_NAMES, NON_SECRET_NAMES, type KeyName } from './keystore-names.ts';
const ACTIVE_PROFILE = runtimeProfile();
const ENV_PATH = ACTIVE_PROFILE.keystorePath;
const SETTABLE = new Set<string>(KEY_NAMES);
const store = new Map<string, string>();
export function seedKeystore(env: Record<string, string>): void {
  for (const name of KEY_NAMES) {
    const value = (env[name] ?? process.env[name] ?? '').trim();
    if (value) store.set(name, value);
  }
}
export function getKey(name: KeyName): string { return store.get(name) ?? ''; }
/** Preserve unknown legacy entries on disk without loading or using them. */
export async function setKeys(patch: Record<string, unknown>): Promise<void> {
  const clean = new Map<string, string>();
  for (const [name, raw] of Object.entries(patch)) {
    if (!SETTABLE.has(name)) throw new Error('unsupported editor setting');
    const value = String(raw ?? '').trim();
    if (/[\r\n]/.test(value)) throw new Error('invalid setting value');
    clean.set(name, value);
  }
  if (!clean.size) return;
  const existing = await readFile(ENV_PATH, "utf8").catch(
    (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") return "";
      throw err;
    },
  );
  const isolated = isIsolatedDevProfile(ACTIVE_PROFILE);
  const merged = mergeEnvText(existing, clean, isolated);
  await atomicWriteFile(ENV_PATH, merged, { mode: 0o600 });
  for (const [name, value] of clean) {
    if (value) store.set(name, value);
    else store.delete(name);
  }
}
