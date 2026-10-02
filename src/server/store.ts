import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { emptyData, type Data } from '../shared/model.js';
import { DataError, validateData } from '../shared/validation.js';
export class Store {
  readonly file: string;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(public directory: string) { this.file = join(directory, 'taskotter.json'); }
  async initialize() {
    await mkdir(this.directory, { recursive: true });
    // Explicit initialization only: never called automatically by the server.
    const handle = await open(this.file, 'wx');
    try { await handle.writeFile(JSON.stringify(emptyData(), null, 2) + '\n'); await handle.sync(); } finally { await handle.close(); }
  }
  async read(): Promise<Data> {
    let text: string;
    try { text = await readFile(this.file, 'utf8'); } catch (e) { throw new DataError([`taskotter.json を読めません。初回は npm run init、運用中は保存先・ファイルを確認してください。${(e as Error).message}`], 503); }
    let data: unknown;
    try { data = JSON.parse(text); } catch (e) { throw new DataError([`taskotter.json JSON構文エラー: ${(e as Error).message}`]); }
    validateData(data); return data;
  }
  async change(operation: (data: Data) => void): Promise<Data> {
    const action = this.queue.then(async () => {
      const data = await this.read();
      operation(data); validateData(data);
      const temporary = join(this.directory, `.taskotter-${randomUUID()}.tmp`);
      try {
        const handle = await open(temporary, 'wx', 0o600);
        try { await handle.writeFile(JSON.stringify(data, null, 2) + '\n'); await handle.sync(); } finally { await handle.close(); }
        await rename(temporary, this.file);
      } finally { await unlink(temporary).catch(() => {}); }
      return data;
    });
    this.queue = action.catch(() => {}); return action;
  }
}
