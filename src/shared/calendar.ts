import { minute } from './model.js';

export type ScheduleRange = { start: number; end: number };
export function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
// Add within the interval under the pointer, never forward into the next appointment.
export function snappedMinute(raw: number, step: number): number {
  return Math.max(0, Math.min(Math.floor(1439 / step) * step, Math.floor(raw / step) * step));
}
export function moveSchedule(start: string, end: string, raw: number, step: number): ScheduleRange {
  const duration = minute(end) - minute(start);
  const maximum = Math.max(0, Math.floor((1439 - duration) / step) * step);
  const next = Math.max(0, Math.min(maximum, Math.round(raw / step) * step));
  return { start: next, end: next + duration };
}
export function resizeSchedule(start: string, end: string, edge: 'start' | 'end', raw: number, step: number): ScheduleRange {
  const from = minute(start), to = minute(end), snapped = Math.round(raw / step) * step;
  // Preserve the fixed edge even for legacy times that do not fall on the current grid.
  if (edge === 'start') return { start: Math.max(0, Math.min(Math.max(0, Math.floor((to - step) / step) * step), snapped)), end: to };
  return { start: from, end: Math.min(1439, Math.max(Math.ceil((from + step) / step) * step, snapped)) };
}
