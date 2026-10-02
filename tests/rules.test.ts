import { describe, expect, it } from 'vitest';
import { schema } from '../src/shared/schema.js';
import { emptyData, newTask, newOutcome, inRange, overflow, layoutSchedule, addDays, dayDistance } from '../src/shared/model.js';
import { validateData } from '../src/shared/validation.js';
import { readFileSync } from 'node:fs';
describe('data specification and rules', () => {
  it('exported JSON Schema matches the source', () => { expect(JSON.parse(readFileSync('schemas/taskotter.schema.json', 'utf8'))).toEqual(schema); });
  it.each(['Inbox', 'NextAction', 'Waiting', 'Doing', 'Done', 'Someday'] as const)('accepts %s with all optional values empty', status => {
    const d = emptyData(); d.tasks.push({ ...newTask('Task', 't'), status }); expect(() => validateData(d)).not.toThrow();
  });
  it.each([
    { start: 'before', end: '2026-10-02' }, { start: '2026-10-02', end: 'after' },
    { start: 'before', end: 'after' }, { start: '2026-10-02', end: '2026-10-02' },
  ])('includes boundaries and unbounded periods: %j', range => {
    const d = emptyData(); const t = { ...newTask('Task', 't'), ...range }; d.tasks.push(t); validateData(d);
    expect(inRange(t, '2026-10-02')).toBe(true); expect(inRange({ ...t, status: 'Done' }, '2026-10-02')).toBe(false);
  });
  it('does not include absent periods or dates outside bounds', () => {
    const t = newTask('Task', 't'); expect(inRange(t, '2026-10-02')).toBe(false);
    Object.assign(t, { start: '2026-10-03', end: '2026-10-05' }); expect(inRange(t, '2026-10-02')).toBe(false); expect(inRange(t, '2026-10-06')).toBe(false);
  });
  it.each([
    { due: '2026-02-30' }, { start: '2026-10-02', end: '' }, { start: '', end: 'after' },
    { start: '2026-10-03', end: '2026-10-02' }, { next: '2026-02-30T10:00', nextEnd: '11:00' },
    { next: '2026-10-02T10:00', nextEnd: '' }, { next: '', nextEnd: '11:00' },
    { next: '2026-10-02T10:00', nextEnd: '10:00' }, { next: '2026-10-02T10:00', nextEnd: '09:00' },
    { next: '2026-10-02T24:00', nextEnd: '11:00' }, { outcomeId: 'missing' }, { unexpected: true }, { name: '   ' },
  ])('rejects invalid Task: %j', fields => { const d = emptyData(); d.tasks.push({ ...newTask('Task', 't'), ...fields }); expect(() => validateData(d)).toThrow(); });
  it('rejects duplicate IDs across tasks and outcomes', () => { const d = emptyData(); d.tasks.push(newTask('Task', 'id')); d.outcomes.push(newOutcome('Outcome', 'id')); expect(() => validateData(d)).toThrow(/重複/); });
  it('allows manual completion only when all linked tasks are Done, including zero tasks', () => {
    const d = emptyData(); d.outcomes.push({ ...newOutcome('Outcome', 'o'), complete: true }); validateData(d);
    d.tasks.push({ ...newTask('Task', 't'), outcomeId: 'o' }); expect(() => validateData(d)).toThrow(/未完了/);
    d.tasks[0].status = 'Done'; validateData(d);
  });
  it('warns about overflow without rejecting valid data', () => {
    const d = emptyData(); d.outcomes.push({ ...newOutcome('Outcome', 'o'), start: '2026-10-02', end: '2026-10-10' });
    const t = { ...newTask('Task', 't'), outcomeId: 'o', start: 'before', end: 'after' }; d.tasks.push(t); validateData(d); expect(overflow(t, d.outcomes)).toBe(true);
    t.start = '2026-10-02'; t.end = '2026-10-10'; expect(overflow(t, d.outcomes)).toBe(false);
  });
  it('calculates days across DST without moving date-only boundaries', () => { expect(addDays('2026-03-08', 1)).toBe('2026-03-09'); expect(dayDistance('2026-03-07', '2026-03-09')).toBe(2); });
  it('partitions overlapping schedules without hiding any task', () => {
    const tasks = ['09:00', '09:30', '10:00', '12:00'].map((s, i) => ({ ...newTask(`Task ${i}`, String(i)), next: `2026-10-02T${s}`, nextEnd: ['10:00', '11:00', '11:30', '13:00'][i] }));
    const result = layoutSchedule(tasks); expect(result).toHaveLength(4);
    expect(result.map(x => [x.column, x.columns])).toEqual([[0, 2], [1, 2], [0, 2], [0, 1]]);
  });
});
