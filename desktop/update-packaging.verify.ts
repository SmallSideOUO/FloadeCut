import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { build } from 'esbuild';
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
// An unpacked app inside the checkout can accidentally resolve a missing runtime
// package from the checkout's devDependencies. Installed apps have no such fallback.
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const built = await build({ entryPoints: ['desktop/main.ts'], bundle: true, platform: 'node', format: 'esm', packages: 'external', metafile: true, write: false, logLevel: 'silent' });
for (const output of Object.values(built.metafile!.outputs)) {
  for (const imported of output.imports.filter((entry) => entry.external)) {
    const name = imported.path.startsWith('@') ? imported.path.split('/').slice(0, 2).join('/') : imported.path.split('/')[0];
    if (imported.path.startsWith('node:') || builtinModules.includes(imported.path) || name === 'electron') continue;
    assert.ok(manifest.dependencies[name], `desktop runtime import ${name} must be a production dependency`);
    assert.ok(lock.packages[`node_modules/${name}`] && !lock.packages[`node_modules/${name}`].dev && !lock.packages[`node_modules/${name}`].optional,
      `desktop runtime import ${name} must be required in the production lockfile`);
  }
}
console.log('Floade packaging: desktop launch bundles, license notices, and no internal AI workers');
