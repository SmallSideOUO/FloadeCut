import { constants } from 'node:fs';
import { copyFile, link, lstat, mkdir, readdir, rm, unlink } from 'node:fs/promises';
import path from 'node:path';

/** Regular-file mirror for Windows render servers: no directory junctions. */
export async function mirrorReadableUploads(source, destination) {
  const sourceRoot = path.resolve(source);
  const destinationRoot = path.resolve(destination);
  if (sourceRoot === destinationRoot || destinationRoot.startsWith(sourceRoot + path.sep)
    || sourceRoot.startsWith(destinationRoot + path.sep)) throw new Error('Upload mirror roots must be separate');
  const sync = async (from, to) => {
    const target = await lstat(to).catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (target?.isSymbolicLink() || (target && !target.isDirectory())) {
      throw new Error(`Upload mirror destination must be a regular directory: ${to}`);
    }
    await mkdir(to, { recursive: true });
    const names = await readdir(from);
    const retained = new Set();
    for (const name of names) {
      if (name === '.references') continue;
      const src = path.join(from, name);
      const dst = path.join(to, name);
      const info = await lstat(src).catch((error) => {
        // Old failed Windows exports can leave malformed reparse points.
        if (['ENOENT', 'ENOTDIR', 'UNKNOWN'].includes(error.code)) return null;
        throw error;
      });
      if (!info || info.isSymbolicLink()) continue;
      retained.add(name);
      if (info.isDirectory()) {
        await sync(src, dst);
      } else if (info.isFile()) {
        const previous = await lstat(dst).catch((error) => {
          if (error.code === 'ENOENT') return null;
          throw error;
        });
        if (previous?.isFile() && info.dev === previous.dev && info.ino === previous.ino) continue;
        if (previous) {
          if (previous.isDirectory()) throw new Error(`Unexpected upload mirror directory: ${dst}`);
          await unlink(dst);
        }
        try { await link(src, dst); }
        catch { await copyFile(src, dst, constants.COPYFILE_FICLONE); }
      }
    }
    for (const name of await readdir(to)) {
      if (!retained.has(name)) await rm(path.join(to, name), { recursive: true, force: true });
    }
  };
  await sync(sourceRoot, destinationRoot);
}
