import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export function createFileWorkspaceStore(directory) {
  const root = path.resolve(directory), pending = new Map();
  const filename = key => { if (!/^[a-z-]+$/.test(key)) throw new Error('Invalid storage key'); return path.join(root, key + '.json'); };
  async function read(key) { try { return JSON.parse(await fs.readFile(filename(key), 'utf8')); } catch (cause) { if (cause.code === 'ENOENT') return null; throw cause; } }
  return { read, update(key, modify) {
    const operation = (pending.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
      const updated = modify(await read(key)); await fs.mkdir(root, { recursive: true });
      const temporary = filename(key) + '.' + randomUUID() + '.tmp';
      try {
        await fs.writeFile(temporary, JSON.stringify(updated), { mode: 0o600 });
        for (let attempt = 0; ; attempt++) {
          try { await fs.rename(temporary, filename(key)); break; }
          catch (cause) { if (!['EPERM','EBUSY','EACCES'].includes(cause.code) || attempt >= 9) throw cause; await new Promise(resolve => setTimeout(resolve, 50)); }
        }
      }
      finally { await fs.rm(temporary, { force: true }); }
      return updated;
    });
    pending.set(key, operation); operation.finally(() => { if (pending.get(key) === operation) pending.delete(key); }).catch(() => {}); return operation;
  } };
}
