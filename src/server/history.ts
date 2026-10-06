import { dateLabel, type Data, type Task, type Outcome } from '../shared/model.js';

type Item = Task | Outcome;
type Entry = Record<string, unknown>;
const fields = { name: '名前', memo: 'メモ', category: 'カテゴリ', status: 'ステータス', due: '締切日', start: '期間開始日', end: '期間終了日', next: '次の対応予定', nextEnd: '終了時刻', outcomeId: 'Outcome', nextAction: '次の予定で行うこと', complete: '完了', priority: '旧優先度' };
const arrays = { materials: '資料', chats: '関連チャット', subtasks: 'サブタスク' };
const record = (item: unknown) => item as Entry;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(record(value)[key])).join(',') + '}';
  return JSON.stringify(value) || 'null';
}
function labelValue(key: string, value: unknown, data: Data): string {
  if (key === 'outcomeId') return value ? data.outcomes.find(o => o.id === value)?.name.slice(0, 60) || '削除されたOutcome' : 'Outcomeなし';
  if (value === undefined || value === '') return '未設定';
  if (key === 'complete') return value ? '完了' : '未完了';
  if (value === 'before') return '以前';
  if (value === 'after') return '以降';
  if (['due', 'start', 'end'].includes(key)) return String(value).slice(0, 4) + '/' + dateLabel(String(value));
  if (key === 'next') return String(value).slice(0, 4) + '/' + dateLabel(String(value).slice(0, 10)) + ' ' + String(value).slice(11);
  return String(value).length > 60 ? String(value).slice(0, 59) + '…' : String(value);
}
function arraySummary(key: string, label: string, oldValue: unknown, newValue: unknown): string[] {
  const old = (oldValue || []) as Entry[], next = (newValue || []) as Entry[];
  if (canonical(old) === canonical(next)) return [];
  const oldIds = new Map(old.map(row => [row.id, row])), nextIds = new Map(next.map(row => [row.id, row]));
  const added = next.filter(row => !oldIds.has(row.id)).length, removed = old.filter(row => !nextIds.has(row.id)).length;
  const shared = next.filter(row => oldIds.has(row.id)), result: string[] = [];
  if (added) result.push(`${label}を${added}件追加`);
  if (removed) result.push(`${label}を${removed}件削除`);
  if (key === 'subtasks') {
    const done = shared.filter(row => row.complete === true && oldIds.get(row.id)!.complete === false).length;
    const undone = shared.filter(row => row.complete === false && oldIds.get(row.id)!.complete === true).length;
    const renamed = shared.filter(row => row.name !== oldIds.get(row.id)!.name).length;
    if (done) result.push(`サブタスクを${done}件完了`);
    if (undone) result.push(`サブタスクを${undone}件未完了に変更`);
    if (renamed) result.push(`サブタスク名を${renamed}件変更`);
  } else {
    const urls = shared.filter(row => row.url !== oldIds.get(row.id)!.url).length;
    const summaries = shared.filter(row => row.summary !== oldIds.get(row.id)!.summary).length;
    if (urls) result.push(`${label}のリンク先を${urls}件変更`);
    if (summaries) result.push(`${label}の概要を${summaries}件変更`);
  }
  return result.length ? result : [`${label}の順序を変更`];
}
function summary(before: Item, after: Item, oldData: Data, data: Data): string {
  const old = record(before), next = record(after), changes: string[] = [];
  for (const [key, label] of Object.entries(fields)) {
    if (canonical(old[key] ?? '') === canonical(next[key] ?? '')) continue;
    if (['name', 'memo', 'nextAction'].includes(key)) changes.push(`${label}を変更`);
    else changes.push(`${label}：${labelValue(key, old[key], oldData)} → ${labelValue(key, next[key], data)}`);
  }
  for (const [key, label] of Object.entries(arrays)) changes.push(...arraySummary(key, label, old[key], next[key]));
  const text = changes.join('、');
  return text.length > 1000 ? text.slice(0, 999) + '…' : text;
}
// Called inside Store.change: metadata and business changes share one atomic write.
export function recordHistory(before: Data, data: Data, at = new Date().toISOString()): void {
  for (const kind of ['tasks', 'outcomes'] as const) {
    const originals = new Map<string, Item>(before[kind].map(item => [item.id, item]));
    for (const item of data[kind]) {
      const original = originals.get(item.id);
      // Client-supplied metadata is ignored, including attempts to replace history.
      delete item.createdAt; delete item.updatedAt; delete item.history;
      if (!original) {
        item.createdAt = at; item.updatedAt = at;
        item.history = [{ at, summary: `${kind === 'tasks' ? 'Task' : 'Outcome'}を作成` }];
        continue;
      }
      if (original.createdAt !== undefined) item.createdAt = original.createdAt;
      if (original.updatedAt !== undefined) item.updatedAt = original.updatedAt;
      if (original.history !== undefined) item.history = original.history;
      const text = summary(original, item, before, data);
      if (text) { item.updatedAt = at; item.history = [...(original.history || []), { at, summary: text }]; }
    }
  }
}
