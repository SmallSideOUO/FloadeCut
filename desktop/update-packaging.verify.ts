import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
process.env.CC_EB_TARGET = 'win32-x64';
const configUrl = new URL('../config/electron-builder.config.mjs', import.meta.url).href;
const { default: config } = await import(configUrl);
assert.equal(config.productName, 'Floade');
assert.equal(config.publish, null, 'never install updates from the upstream product');
for (const bundle of ['desktop-dist/main.mjs', 'desktop-dist/app-main.mjs', 'desktop-dist/preload.cjs']) {
  assert.ok(config.files.includes(bundle), 'packaged startup must include both main bundles and preload');
}
assert.ok(!config.files.some((file: string) => /native-.*worker/.test(file)));
assert.ok(!config.asarUnpack.some((file: string) => /onnxruntime|copilot/.test(file)));
assert.ok(existsSync(config.win.icon));
assert.equal(config.nsis.createDesktopShortcut, 'always');
assert.ok(config.extraResources.some((entry: { from: string }) => entry.from === 'LICENSE'));
assert.ok(config.extraResources.some((entry: { from: string }) => entry.from.endsWith('FLOADE-NEED-LICENSE.txt')));
console.log('Floade packaging: desktop launch bundles, license notices, and no internal AI workers');
