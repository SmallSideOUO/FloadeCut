import { parseArgs } from 'node:util';
import { mkdir, link, copyFile, unlink, stat } from 'node:fs/promises';
import { constants, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const { values } = parseArgs({ options: {
  project: { type: 'string' }, output: { type: 'string' }, resolution: { type: 'string', default: '1080p' },
  fps: { type: 'string', default: '60' }, url: { type: 'string', default: 'http://127.0.0.1:5199' },
} });
const origin = new URL(values.url).origin;
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) throw new Error('The command API must be local');
const headers = { Origin: origin, 'Sec-Fetch-Site': 'none', 'Content-Type': 'application/json' };
async function request(route, body) {
  const response = await fetch(`${origin}/api/commands${route}`, { headers, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? JSON.stringify(result));
  return result;
}
if (!values.project || !values.output) {
  console.log(JSON.stringify(await request('/projects'), null, 2));
  console.log('Usage: node cli/local-export.mjs --project <id> --output <file.mp4> [--resolution 1080p] [--fps 60]');
} else {
  const output = path.resolve(values.output);
  if (await stat(output).then(() => true, (error) => { if (error.code === 'ENOENT') return false; throw error; })) throw new Error(`Output already exists: ${output}`);
  await mkdir(path.dirname(output), { recursive: true });
  const submitted = await request('/exports', { projectId: values.project, resolution: values.resolution, fps: Number(values.fps), name: path.basename(output) });
  if (typeof submitted.renderId !== 'string') throw new Error('Export server returned no job identity');
  console.log(`Export job ${submitted.renderId}`);
  let job;
  let last = '';
  const deadline = Date.now() + 60 * 60_000;
  while (Date.now() < deadline) {
    job = await request(`/exports/${submitted.renderId}`);
    const progress = `${job.status} ${job.phase ?? ''} ${Math.round(job.progress ?? 0)}% ${job.processedFrames ?? 0}/${job.totalFrames ?? 0}`;
    if (progress !== last) console.log(progress);
    last = progress;
    if (job.status === 'completed' || job.status === 'succeeded') break;
    if (['failed', 'cancelled', 'canceled', 'interrupted'].includes(job.status)) throw new Error(job.failure?.message ?? job.error ?? `Export ${job.status}`);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  if (!['completed', 'succeeded'].includes(job?.status)) throw new Error('Export wait timed out');
  const source = job.result?.path;
  if (typeof source !== 'string' || !source.startsWith('/media/uploads/')) throw new Error('Export returned an invalid local media path');
  const response = await fetch(`${origin}${source}`, { headers });
  if (!response.ok || !response.body) throw new Error(`Could not read the exported video: HTTP ${response.status}`);
  const partial = `${output}.partial-${randomUUID()}`;
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial, { flags: 'wx' }));
    if ((await stat(partial)).size === 0) throw new Error('Export produced an empty video');
    try { await link(partial, output); }
    catch (error) { if (error.code === 'EEXIST') throw error; await copyFile(partial, output, constants.COPYFILE_EXCL); }
    console.log(JSON.stringify({ output, bytes: (await stat(output)).size, resolution: values.resolution, fps: Number(values.fps) }));
  } finally {
    await unlink(partial).catch(() => undefined);
  }
}
