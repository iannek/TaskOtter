import type { Data } from '../shared/model.js';
export async function api(path = '/api/data', method = 'GET', body?: unknown): Promise<Data> {
  // Audit metadata is owned by the server and need not be echoed on every save.
  if (body && typeof body === 'object' && (path.startsWith('/api/tasks') || path.startsWith('/api/outcomes'))) {
    const strip = (value: object) => { const { createdAt, updatedAt, history, ...content } = value as Record<string, unknown>; return content; };
    const payload = body as Record<string, unknown>;
    body = payload.task && typeof payload.task === 'object' ? { ...payload, task: strip(payload.task) } : strip(payload);
  }
  const response = await fetch(path, { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'データを読み込めません');
  return data as Data;
}
