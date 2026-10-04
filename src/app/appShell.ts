import { startUiLocaleSync } from '../i18n/localeSync';
import { t } from '../i18n/locale';
import { useCallback, useEffect, useState } from 'react';
import type { ProjectDoc, TimelineState } from '../editor/types';
import {
  createProject,
  docFromTimeline,
  hasProjectHistory,
  listProjects,
} from '../persist/projectStore';
import type { ProjectMeta } from '../persist/projectStoreCoordinators';
import { kvRemoteMode } from '../persist/sharedKv';
import { projectStoreWriteCredential } from '../persist/projectStoreTransport';

export type AppRoute = { name: 'dashboard' } | { name: 'editor'; id: string };

const emptyState = (): TimelineState => ({
  fps: 30,
  width: 1920,
  height: 1080,
  items: [],
  selectedId: null,
  trackOrder: ['track_v1'],
  tracks: { track_v1: { kind: 'video' } },
});

export const emptyProjectDoc = (): ProjectDoc => docFromTimeline(emptyState());
// Keep the sample timeline out of established users' startup bundle; it is needed only on first run.
const seedDoc = async (): Promise<ProjectDoc> => docFromTimeline((await import('../editor/initial')).INITIAL);

function parseHash(): AppRoute {
  const match = window.location.hash.match(/^#\/editor\/(.+)$/);
  return match ? { name: 'editor', id: match[1] } : { name: 'dashboard' };
}

export function navigateTo(hash: string): void {
  window.location.hash = hash;
}

export function useAppRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(parseHash());
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

export function useUiLocaleSync(): void {
  useEffect(() => startUiLocaleSync(), []);
}

export interface ProjectStartupSource {
  list(): Promise<ProjectMeta[]>;
  hasHistory(): Promise<boolean>;
  canSeedDemo(): boolean;
  createDemo(): Promise<ProjectMeta>;
}

const projectStartupSource: ProjectStartupSource = {
  list: listProjects,
  hasHistory: hasProjectHistory,
  canSeedDemo: () => kvRemoteMode() === 'local' || projectStoreWriteCredential(),
  createDemo: async () => createProject(t('示例工程'), await seedDoc()),
};

export async function loadInitialProjects(
  source: ProjectStartupSource = projectStartupSource,
): Promise<ProjectMeta[]> {
  const list = await source.list();
  if (list.length > 0 || await source.hasHistory()) return list;
  if (!source.canSeedDemo()) return [];
  return [await source.createDemo()];
}

export function useProjects(): {
  projects: ProjectMeta[] | null;
  refresh: () => Promise<void>;
} {
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);
  const refresh = useCallback(async () => { setProjects(await listProjects()); }, []);
  useEffect(() => {
    void loadInitialProjects().then(setProjects);
  }, []);
  return { projects, refresh };
}
