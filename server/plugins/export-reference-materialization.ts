import { constants } from 'node:fs';
import { copyFile, link, mkdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import type { ExportMediaReference } from '../../src/export/exportMediaPlan.ts';
import { uploadNameOfSource } from '../media-dir.ts';

const EXPORT_REFERENCE_DIRECTORY = 'export-references';

export interface ExportReferenceMaterialization {
  readonly replacements: ReadonlyMap<string, string>;
  readonly localPaths: readonly string[];
}

async function removeMaterializedReferences(paths: readonly string[]): Promise<void> {
  await Promise.all(paths.map((path) => rm(path, { recursive: true, force: true })));
}

/** Stage only the referenced file: hard-link when possible, copy across volumes.
 * Windows directory junctions can be unreadable to the packaged renderer even
 * though creation succeeds. Regular files also avoid exposing sibling media.
 */
export async function materializeExportReferences(
  references: readonly ExportMediaReference[],
  uploadDirectory: string,
  resolveReference: (name: string) => string | null,
  signal?: AbortSignal,
): Promise<ExportReferenceMaterialization> {
  const replacements = new Map<string, string>();
  const localPaths: string[] = [];
  const root = join(uploadDirectory, EXPORT_REFERENCE_DIRECTORY);
  try {
    for (const reference of references) {
      signal?.throwIfAborted();
      if (replacements.has(reference.source)) continue;
      const name = uploadNameOfSource(reference.source);
      const source = name ? resolveReference(name) : null;
      if (!source) continue;
      await mkdir(root, { recursive: true });
      const linkName = randomUUID();
      const linkPath = join(root, linkName);
      await mkdir(linkPath);
      localPaths.push(linkPath);
      const stagedFile = join(linkPath, basename(source));
      try {
        await link(source, stagedFile);
      } catch {
        signal?.throwIfAborted();
        // FICLONE falls back to a normal copy when the filesystem cannot clone.
        await copyFile(source, stagedFile, constants.COPYFILE_FICLONE);
      }
      signal?.throwIfAborted();
      replacements.set(
        reference.source,
        `/media/uploads/${EXPORT_REFERENCE_DIRECTORY}/${linkName}/${encodeURIComponent(basename(source))}`,
      );
    }
    signal?.throwIfAborted();
    return { replacements, localPaths };
  } catch (error) {
    await removeMaterializedReferences(localPaths);
    throw error;
  }
}
