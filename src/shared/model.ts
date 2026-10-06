import type { FromSchema } from 'json-schema-to-ts';
import { schema } from './schema.js';
export type Data = FromSchema<typeof schema>;
export type Task = Data['tasks'][number];
export type Reference = NonNullable<Task['materials']>[number];
export type Subtask = NonNullable<Task['subtasks']>[number];
export type Outcome = Data['outcomes'][number];
export const statuses: Task['status'][] = ['Inbox', 'NextAction', 'Waiting', 'Doing', 'Done', 'Someday'];
export const emptyData = (): Data => ({ schemaVersion: 1, settings: { timeStep: 15 }, tasks: [], outcomes: [] });
export const newTask = (name = '', id = ''): Task => ({ id, name, memo: '', category: '', status: 'Inbox', due: '', start: '', end: '', next: '', nextEnd: '', outcomeId: '', nextAction: '', subtasks: [], materials: [], chats: [] });
export const newOutcome = (name = '', id = ''): Outcome => ({ id, name, memo: '', start: '', end: '', complete: false });
export function localDate(d = new Date()): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function dateLabel(day: string): string { const d = new Date(`${day}T12:00:00`); return `${d.getMonth() + 1}/${d.getDate()}(${['日', '月', '火', '水', '木', '金', '土'][d.getDay()]})`; }
export function addDays(day: string, n: number): string { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); return localDate(d); }
export function dayDistance(a: string, b: string): number { return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000); }
export function inRange(t: Task, day: string): boolean { return !!(t.start && t.end && t.status !== 'Done' && (t.start === 'before' || t.start <= day) && (t.end === 'after' || t.end >= day)); }
export function overflow(t: Pick<Task, 'start' | 'end' | 'outcomeId'>, outcomes: Outcome[]): boolean { const o = outcomes.find(o => o.id === t.outcomeId); return !!(o?.start && o.end && t.start && t.end && (t.start === 'before' || t.start < o.start || t.end === 'after' || t.end > o.end)); }
export function rangeText(t: { start: string; end: string }): string { return t.start && t.end ? `${t.start === 'before' ? '以前' : dateLabel(t.start)} 〜 ${t.end === 'after' ? '以降' : dateLabel(t.end)}` : '-'; }
export function minute(time: string): number { const [h, m] = time.split(':').map(Number); return h * 60 + m; }
// Interval partitioning: overlapping calendar events always occupy distinct columns.
export function layoutSchedule(tasks: Task[]): { task: Task; column: number; columns: number }[] {
  const sorted = [...tasks].sort((a, b) => a.next.localeCompare(b.next) || a.nextEnd.localeCompare(b.nextEnd));
  const result: { task: Task; column: number; columns: number }[] = [];
  let group: typeof result = [], ends: number[] = [], groupEnd = -1;
  const flush = () => { for (const item of group) item.columns = ends.length; result.push(...group); group = []; ends = []; };
  for (const task of sorted) {
    const start = minute(task.next.slice(11)), end = minute(task.nextEnd);
    if (start >= groupEnd) { flush(); groupEnd = -1; }
    let column = ends.findIndex(e => e <= start);
    if (column < 0) column = ends.length;
    ends[column] = end; groupEnd = Math.max(groupEnd, end); group.push({ task, column, columns: 1 });
  }
  flush(); return result;
}

// Preserve the pre-completion status centrally, including updates from external API clients.
export function rememberCompletion(previous: Task | undefined, next: Task): Task {
  const result = { ...next };
  if (next.status === 'Done' && previous?.status !== 'Done') result.previousStatus = previous?.status || next.previousStatus || 'Inbox';
  else if (previous?.previousStatus) result.previousStatus = previous.previousStatus;
  return result;
}
export function monthSegments(days: string[]): { month: string; offset: number; count: number }[] {
  const result: { month: string; offset: number; count: number }[] = [];
  for (const [offset, day] of days.entries()) {
    const month = day.slice(0, 7), previous = result.at(-1);
    if (previous?.month === month) previous.count++; else result.push({ month, offset, count: 1 });
  }
  return result;
}
export function dateTimeLabel(value?: string): string {
  if (!value) return '不明';
  const date = new Date(value);
  return `${date.getFullYear()}/${dateLabel(localDate(date))} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
