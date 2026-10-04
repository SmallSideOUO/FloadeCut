import { useCallback, useEffect, useRef } from 'react';
import type { PlayerRef } from '@remotion/player';
import { useT } from '../i18n/locale';
import { pendingAutosaveAfterObservation, recoverFailedAutosave } from '../persist/autosaveRecovery';
import {
  flushProjectSaves,
  hasPendingProjectSaves,
  hasProjectSaveFailure,
  saveProject,
} from '../persist/projectStore';
import type { ProjectSaveResult } from '../persist/projectStoreCoordinators';
import { showAppToast } from '../ui/appToast';
import type { ProjectDoc } from './types';

type MutableRef<T> = { current: T };

interface EditorProjectPersistenceOptions {
  projectId: string;
  doc: ProjectDoc;
  playerRef: MutableRef<PlayerRef | null>;
  flushBeforeLeaveRef: MutableRef<() => Promise<boolean>>;
  onHome: () => void;
}

interface PendingSave {
  projectId: string;
  doc: ProjectDoc;
}

function usePendingSaveQueue(): {
  unsavedRef: MutableRef<PendingSave | null>;
  enqueuePendingSave: () => Promise<ProjectSaveResult> | null;
} {
  const t = useT();
  const unsavedRef = useRef<PendingSave | null>(null);
  const latestSaveAttemptRef = useRef(0);
  const saveFailureShownRef = useRef(false);
  const observeSave = useCallback((result: ProjectSaveResult): void => {
    if (result.status === 'failed') {
      if (!saveFailureShownRef.current) {
        showAppToast(t('工程保存失败。请重试；在保存成功前不会关闭或切换工程。'), { error: true });
        saveFailureShownRef.current = true;
      }
      return;
    }
    saveFailureShownRef.current = false;
  }, [t]);
  const enqueuePendingSave = useCallback((): Promise<ProjectSaveResult> | null => {
    const pending = unsavedRef.current;
    if (!pending) return null;
    unsavedRef.current = null;
    const attempt = ++latestSaveAttemptRef.current;
    const saving = saveProject(pending.projectId, pending.doc);
    void saving.then((result) => {
      if (result.status === 'failed') {
        unsavedRef.current = recoverFailedAutosave({
          currentUnsaved: unsavedRef.current,
          failedSnapshot: pending,
          failedAttempt: attempt,
          latestEnqueuedAttempt: latestSaveAttemptRef.current,
        });
      }
      observeSave(result);
    });
    return saving;
  }, [observeSave]);
  return { unsavedRef, enqueuePendingSave };
}

function useEditorAutosave(projectId: string, doc: ProjectDoc): () => Promise<boolean> {
  const t = useT();
  const { unsavedRef, enqueuePendingSave } = usePendingSaveQueue();
  const previousDocumentRef = useRef<PendingSave | null>(null);
  useEffect(() => {
    const next = { projectId, doc };
    const pending = pendingAutosaveAfterObservation(previousDocumentRef.current, next);
    previousDocumentRef.current = next;
    unsavedRef.current = pending;
    if (pending === null) return undefined;
    const timer = setTimeout(() => { enqueuePendingSave(); }, 500);
    return () => clearTimeout(timer);
  }, [doc, enqueuePendingSave, projectId, unsavedRef]);
  const flushBeforeLeave = useCallback(async (): Promise<boolean> => {
    enqueuePendingSave();
    const result = await flushProjectSaves(projectId);
    if (!result.ok) {
      showAppToast(t('工程仍未保存，已阻止离开。请继续编辑以重试保存。'), { error: true });
      return false;
    }
    return true;
  }, [enqueuePendingSave, projectId, t]);
  useBrowserSaveGuards(projectId, enqueuePendingSave);
  return flushBeforeLeave;
}

function useBrowserSaveGuards(projectId: string, enqueuePendingSave: () => unknown): void {
  useEffect(() => {
    const flushWithoutWaiting = (): void => {
      enqueuePendingSave();
      void flushProjectSaves(projectId);
    };
    const blockUnfinishedSave = (event: BeforeUnloadEvent): void => {
      enqueuePendingSave();
      if (!hasPendingProjectSaves(projectId) && !hasProjectSaveFailure(projectId)) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', blockUnfinishedSave);
    window.addEventListener('pagehide', flushWithoutWaiting);
    return () => {
      window.removeEventListener('beforeunload', blockUnfinishedSave);
      window.removeEventListener('pagehide', flushWithoutWaiting);
      flushWithoutWaiting();
    };
  }, [enqueuePendingSave, projectId]);
}

function useActiveTimelineSeek(activeTimelineId: string, playerRef: MutableRef<PlayerRef | null>): void {
  const firstTimelineRef = useRef(true);
  useEffect(() => {
    if (firstTimelineRef.current) {
      firstTimelineRef.current = false;
      return;
    }
    playerRef.current?.seekTo(0);
  }, [activeTimelineId, playerRef]);
}

export function useEditorProjectPersistence({
  projectId,
  doc,
  playerRef,
  flushBeforeLeaveRef,
  onHome,
}: EditorProjectPersistenceOptions): { handleHome: () => Promise<void> } {
  const flushBeforeLeave = useEditorAutosave(projectId, doc);
  flushBeforeLeaveRef.current = flushBeforeLeave;
  useActiveTimelineSeek(doc.activeTimelineId, playerRef);

  const handleHome = useCallback(async (): Promise<void> => {
    if (await flushBeforeLeave()) onHome();
  }, [flushBeforeLeave, onHome]);

  return { handleHome };
}
