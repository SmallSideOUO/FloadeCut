import assert from 'node:assert/strict';
import { access, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, parse } from 'node:path';
import { materializeServerExportMedia } from './export-media-plan.ts';
// Exercise the same HTTP static handler used by Remotion's render server.
const require = createRequire(import.meta.url);
const { serveHandler } = require(join(dirname(require.resolve('@remotion/renderer')), 'serve-handler/index.js'));

const root = await mkdtemp(join(tmpdir(), 'openchatcut-export-reference-'));
const uploads = join(root, 'uploads');
const publicDirectory = join(root, 'public');
const source = join(root, 'external drive', 'camera original.mp4');

try {
  await mkdir(join(root, 'external drive'), { recursive: true });
  await mkdir(uploads, { recursive: true });
  await mkdir(publicDirectory, { recursive: true });
  await writeFile(source, 'referenced video');
  await writeFile(join(root, 'external drive', 'unrelated.mp4'), 'private sibling');
  const project = {
    items: [{ id: 'clip', kind: 'video', src: '/media/uploads/reference.mp4' }],
  };
  const materialized = await materializeServerExportMedia(project, {
    uploadDirectory: uploads,
    publicDirectory,
    resolveUpload: (name) => name === 'reference.mp4' ? source : null,
    resolveUploadReference: (name) => name === 'reference.mp4' ? source : null,
    hydrateUpload: async () => null,
  });
  const renderSource = materialized.snapshot.items[0]!.src;
  assert.match(renderSource, /^\/media\/uploads\/export-references\//);
  assert.equal(
    await readFile(join(uploads, decodeURIComponent(renderSource.slice('/media/uploads/'.length))), 'utf8'),
    'referenced video',
    'the renderer must read a regular staged file',
  );
  const [linkPath] = materialized.localPaths;
  assert.ok(linkPath);
  assert.equal((await lstat(linkPath)).isSymbolicLink(), false, 'export staging must not depend on a junction');
  const stagedFile = join(uploads, decodeURIComponent(renderSource.slice('/media/uploads/'.length)));
  assert.equal((await lstat(stagedFile)).isFile(), true);
  assert.equal((await lstat(stagedFile)).isSymbolicLink(), false);
  assert.equal((await lstat(source)).size, (await lstat(stagedFile)).size);
  assert.ok((await lstat(source)).nlink >= 2, 'same-volume staging should reuse file bytes through a hard link');
  await assert.rejects(access(join(linkPath, 'unrelated.mp4')), { code: 'ENOENT' });

  const http = createServer((req, res) => { void serveHandler(req, res, { public: root }); });
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  try {
    const address = http.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    // Put the uploads root in the same path layout Remotion serves.
    const servedPath = `/uploads/${renderSource.slice('/media/uploads/'.length)}`;
    const response = await fetch(`${base}${servedPath}`);
    assert.equal(response.status, 200, 'render-server media reads must not return 404');
    assert.equal(await response.text(), 'referenced video');
    const range = await fetch(`${base}${servedPath}`, { headers: { Range: 'bytes=0-9' } });
    assert.equal(range.status, 206);
    assert.equal(await range.text(), 'referenced');
    assert.equal((await fetch(`${base}${servedPath.replace('camera%20original.mp4', 'unrelated.mp4')}`)).status, 404,
      'the render server must not expose the rest of the source directory');
  } finally {
    await new Promise<void>((resolve, reject) => http.close((error) => error ? reject(error) : resolve()));
  }
  await materialized.cleanup();
  await assert.rejects(access(linkPath), { code: 'ENOENT' });
  assert.equal(await readFile(source, 'utf8'), 'referenced video', 'export cleanup must preserve the source');

  // Windows commonly stores originals on D: and the app cache on C:.
  // Exercise the real EXDEV -> copy fallback when two volumes are available.
  const localTemp = process.platform === 'win32' && process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, 'Temp') : null;
  if (localTemp && parse(localTemp).root !== parse(root).root) {
    const otherVolume = await mkdtemp(join(localTemp, 'floade-export-reference-copy-'));
    try {
      const copied = await materializeServerExportMedia(project, {
        uploadDirectory: otherVolume, publicDirectory,
        resolveUpload: () => source, resolveUploadReference: () => source, hydrateUpload: async () => null,
      });
      const file = join(otherVolume, decodeURIComponent(copied.snapshot.items[0]!.src.slice('/media/uploads/'.length)));
      assert.equal(await readFile(file, 'utf8'), 'referenced video');
      assert.equal((await lstat(file)).isFile(), true);
      assert.equal((await lstat(file)).nlink, 1, 'cross-volume export staging copies just the requested file');
      await copied.cleanup();
      await assert.rejects(access(file), { code: 'ENOENT' });
      assert.equal(await readFile(source, 'utf8'), 'referenced video');
    } finally {
      await rm(otherVolume, { recursive: true, force: true });
    }
  }
} finally {
  await rm(root, { recursive: true, force: true });
}

process.stdout.write('export-reference-materialization.verify: regular-file staging, hard links, render-server HTTP/ranges, sibling isolation and cleanup passed\n');
