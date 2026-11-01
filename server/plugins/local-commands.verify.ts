import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { ViteDevServer } from 'vite';
import type { ProjectDoc } from '../../src/editor/types.ts';
import { localCommandsPlugin, savedProjectExportRequest } from './local-commands.ts';
const doc = { version: 3, activeTimelineId: 'tl', assets: [], mediaFolders: [], timelines: [{
  id: 'tl', name: 'main', order: 0, fps: 30, width: 1920, height: 1080,
  tracks: { V1: { kind: 'video' } }, trackOrder: ['V1'], selectedId: null,
  items: [{ id: 'clip', name: 'video', kind: 'video', track: 'V1', startFrame: 0, durationInFrames: 60, src: '/media/uploads/video.mp4' }],
}] } as ProjectDoc;
const readEntry = async (key: string) => key === 'project:test'
  ? { found: true as const, value: doc } : key === 'projects'
    ? { found: true as const, value: [{ id: 'test', name: 'Test' }] } : { found: false as const };
const request = await savedProjectExportRequest({ projectId: 'test', resolution: '1080p', fps: 60 }, readEntry);
assert.equal(request.project, doc);
assert.equal(request.state, doc.timelines[0]);
assert.equal(request.fps, 60);
await assert.rejects(savedProjectExportRequest({ projectId: '../private' }, readEntry), /valid projectId/);
await assert.rejects(savedProjectExportRequest({ projectId: 'missing' }, readEntry), /not found/);
await assert.rejects(savedProjectExportRequest({ projectId: 'test', fps: 17 }, readEntry));
let handler: Parameters<ViteDevServer['middlewares']['use']>[0];
let calls = 0;
const plugin = localCommandsPlugin({ readEntry, fetcher: (async (url, options) => {
  calls++;
  assert.ok(String(url).startsWith('http://127.0.0.1:'));
  if (options?.method === 'POST') assert.equal(JSON.parse(String(options.body)).fps, 60);
  return Response.json({ renderId: '12345678-1234-1234-1234-123456789abc' });
}) as typeof fetch });
const hook = plugin.configureServer;
if (typeof hook !== 'function') throw new Error('Expected configureServer hook');
hook.call({} as never, { middlewares: { use: (_route: string, fn: typeof handler) => { handler = fn; } } } as unknown as ViteDevServer);
const server = createServer((req, res) => { void (handler as Function)(req, res); });
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const headers = { Origin: origin, 'Sec-Fetch-Site': 'none', 'Content-Type': 'application/json' };
  assert.equal((await fetch(`${origin}/projects`, { headers })).status, 200);
  const response = await fetch(`${origin}/exports`, { method: 'POST', headers, body: JSON.stringify({ projectId: 'test', fps: 60 }) });
  assert.equal(response.status, 200);
  assert.ok((await response.json()).renderId);
  assert.equal(calls, 1);
  assert.equal((await fetch(`${origin}/exports`, { method: 'POST', headers: { ...headers, Origin: 'https://example.com' }, body: '{}' })).status, 403);
  assert.equal(calls, 1, 'cross-origin requests must never enqueue exports');
  assert.equal((await fetch(`${origin}/exports`, { method: 'POST', headers, body: JSON.stringify({ projectId: 'test', fps: 17 }) })).status, 400);
  assert.equal(calls, 1, 'invalid output settings must never enqueue exports');
  console.log('local-commands.verify: saved-project export, settings validation and loopback/origin gate passed');
} finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
