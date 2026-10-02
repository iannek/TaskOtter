import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { schema } from './schema.js';
import type { Data } from './model.js';
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats.default(ajv);
const check = ajv.compile(schema);
export class DataError extends Error { constructor(public details: string[], public statusCode = 422) { super(details.join('\n')); } }
export function validateData(value: unknown): asserts value is Data {
  if (!check(value)) throw new DataError(check.errors!.map(e => `${e.instancePath || '/'} ${e.message}${e.params ? ' ' + JSON.stringify(e.params) : ''}`));
  const data = value as Data;
  const errors: string[] = [], ids = new Set<string>();
  for (const [kind, list] of [['outcomes', data.outcomes], ['tasks', data.tasks]] as const) {
    list.forEach((item, i) => {
      const path = `/${kind}/${i}`;
      if (ids.has(item.id)) errors.push(`${path}/id IDが重複しています: ${item.id}`);
      ids.add(item.id);
      if (!!item.start !== !!item.end) errors.push(`${path} 期間は開始・終了の両方が必要です`);
      if (item.start && item.end && item.start !== 'before' && item.end !== 'after' && item.start > item.end) errors.push(`${path} 終了日は開始日以降にしてください`);
    });
  }
  data.tasks.forEach((t, i) => {
    const path = `/tasks/${i}`;
    if (t.outcomeId && !data.outcomes.some(o => o.id === t.outcomeId)) errors.push(`${path}/outcomeId 存在しないOutcomeです`);
    if (!!t.next !== !!t.nextEnd) errors.push(`${path} 次の対応予定は日付・開始・終了が必要です`);
    if (t.next) {
      if (!ajv.validate({ type: 'string', format: 'date' }, t.next.slice(0, 10))) errors.push(`${path}/next 不正な日付です`);
      if (t.next.slice(11) >= t.nextEnd) errors.push(`${path}/nextEnd 終了時刻は開始時刻より後にしてください`);
    }
  });
  data.outcomes.forEach((o, i) => { if (o.complete && data.tasks.some(t => t.outcomeId === o.id && t.status !== 'Done')) errors.push(`/outcomes/${i}/complete 未完了TaskがあるOutcomeは完了にできません`); });
  if (errors.length) throw new DataError(errors);
}
