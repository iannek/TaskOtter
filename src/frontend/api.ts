import type { Data } from '../shared/model.js';
export async function api(path = '/api/data', method = 'GET', body?: unknown): Promise<Data> {
  const response = await fetch(path, { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'データを読み込めません');
  return data as Data;
}
