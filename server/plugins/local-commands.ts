import type { Plugin } from 'vite';
import type { ProjectDoc } from '../../src/editor/types.ts';
import { projectStoreHttpAuthorized, projectStoreReadAuthorized } from '../project-store-http-auth.ts';
import { getStoredEntry } from './project-store.ts';
import { readJsonBody, sendError, sendJson } from './export-http.ts';
import { planExport, type ExportRequest } from './export-plan.ts';

type ReadEntry = typeof getStoredEntry;
interface ExportCommand { projectId?: unknown; timelineId?: unknown; resolution?: unknown; fps?: unknown; name?: unknown; }

export async function savedProjectExportRequest(input: ExportCommand, readEntry: ReadEntry = getStoredEntry): Promise<ExportRequest> {
  if (typeof input.projectId !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(input.projectId)) throw new Error('A valid projectId is required');
  const entry = await readEntry(`project:${input.projectId}`);
  if (!entry.found) throw new Error('Project not found');
  const project = entry.value as ProjectDoc;
  if (!project || !Array.isArray(project.timelines)) throw new Error('Saved project is unreadable');
  const timelineId = input.timelineId ?? project.activeTimelineId;
  const state = project.timelines.find((timeline) => timeline.id === timelineId);
  if (!state) throw new Error('Timeline not found');
  const request = {
    state, project, timelineId, format: 'video', codec: 'h264',
    resolution: input.resolution ?? '1080p', fps: input.fps ?? state.fps,
    ...(input.name === undefined ? {} : { name: input.name }),
  } as ExportRequest;
  planExport(request);
  return request;
}

/** Local command interface; reuses the editor's origin gate and export queue. */
export function localCommandsPlugin(options: { readEntry?: ReadEntry; fetcher?: typeof fetch } = {}): Plugin {
  const readEntry = options.readEntry ?? getStoredEntry;
  const fetcher = options.fetcher ?? fetch;
  return {
    name: 'floade-local-commands',
    configureServer(server) {
      server.middlewares.use('/api/commands', async (req, res) => {
        const writable = req.method === 'POST';
        if (!(writable ? projectStoreHttpAuthorized(req) : projectStoreReadAuthorized(req))) {
          sendError(res, 403, 'local editor request required'); return;
        }
        const route = (req.url ?? '/').split('?')[0];
        const origin = `http://${req.headers.host}`;
        try {
          if (req.method === 'GET' && route === '/projects') {
            const entry = await readEntry('projects');
            sendJson(res, 200, { projects: entry.found && Array.isArray(entry.value) ? entry.value : [] });
            return;
          }
          let target: string;
          let body: string | undefined;
          if (writable && route === '/exports') {
            const input = await readJsonBody(req);
            if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected an export command');
            body = JSON.stringify(await savedProjectExportRequest(input, readEntry));
            target = '/export/job';
          } else if (req.method === 'GET' && /^\/exports\/[0-9a-f-]{36}$/i.test(route)) {
            target = `/export/job/${route.split('/').at(-1)}`;
          } else {
            sendError(res, 404, 'unknown local command'); return;
          }
          const response = await fetcher(`${origin}${target}`, {
            method: body ? 'POST' : 'GET', body,
            headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' },
          });
          sendJson(res, response.status, await response.json());
        } catch (error) {
          sendError(res, 400, error instanceof Error ? error.message : String(error));
        }
      });
    },
  };
}
