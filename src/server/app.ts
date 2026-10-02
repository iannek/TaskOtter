import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Store } from './store.js';
import { schema } from '../shared/schema.js';
import { DataError } from '../shared/validation.js';
import { newOutcome, type Task, type Outcome, type Data } from '../shared/model.js';
export async function createApp(store: Store, staticRoot?: string) {
  const app = Fastify({ logger: false, bodyLimit: 4 * 1024 * 1024, ajv: { customOptions: { coerceTypes: false, removeAdditional: false, useDefaults: false } } });
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api')) {
      reply.header('Cache-Control', 'no-store');
      // Reject browser requests from other origins, including local DNS rebinding.
      let host = '';
      try { host = new URL(`http://${request.headers.host}`).hostname; } catch {}
      if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) return reply.code(403).send({ error: 'ローカル接続のみ利用できます' });
      const origin = request.headers.origin;
      if (origin) {
        let source: URL; try { source = new URL(origin); } catch { return reply.code(403).send({ error: '不正なOriginです' }); }
        if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname) || source.host !== request.headers.host) return reply.code(403).send({ error: '他のサイトからの操作はできません' });
      }
      if (request.headers['sec-fetch-site'] === 'cross-site') return reply.code(403).send({ error: '他のサイトからの操作はできません' });
    }
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DataError) return reply.code(error.statusCode).send({ error: error.message, details: error.details });
    const failure = error as Error & { statusCode?: number };
    const status = failure.statusCode || 500;
    reply.code(status).send({ error: status < 500 ? failure.message : '保存処理に失敗しました。保存先とアクセス権を確認してください。' });
  });
  app.get('/api/data', async () => store.read());
  const itemSchema = (kind: 'task' | 'outcome') => ({ ...schema.definitions[kind], definitions: schema.definitions });
  for (const kind of ['tasks', 'outcomes'] as const) {
    const bodySchema = itemSchema(kind === 'tasks' ? 'task' : 'outcome');
    const apply = (data: Data, item: Task | Outcome, id: string, update: boolean) => {
      const list = data[kind] as (Task | Outcome)[];
      const index = list.findIndex(x => x.id === id);
      if (update && index < 0) throw new DataError(['対象データが見つかりません。再読み込みしてください。'], 404);
      const value = { ...item, id };
      if (update) list[index] = value; else list.push(value);
      if (kind === 'tasks') {
        const task = value as Task;
        if (task.status !== 'Done') { const outcome = data.outcomes.find(o => o.id === task.outcomeId); if (outcome) outcome.complete = false; }
      }
    };
    app.post<{ Body: Task | Outcome }>(`/api/${kind}`, { schema: { body: { ...bodySchema, required: bodySchema.required.filter(key => key !== 'id'), properties: { ...bodySchema.properties, id: { type: 'string' } } } } }, async request => store.change(data => apply(data, request.body, randomUUID(), false)));
    app.put<{ Body: Task | Outcome; Params: { id: string } }>(`/api/${kind}/:id`, { schema: { body: bodySchema } }, async request => store.change(data => apply(data, request.body, request.params.id, true)));
    app.delete<{ Params: { id: string } }>(`/api/${kind}/:id`, async request => store.change(data => {
      if (!data[kind].some(x => x.id === request.params.id)) throw new DataError(['対象データが見つかりません'], 404);
      if (kind === 'tasks') data.tasks = data.tasks.filter(t => t.id !== request.params.id);
      else { data.outcomes = data.outcomes.filter(o => o.id !== request.params.id); for (const t of data.tasks) if (t.outcomeId === request.params.id) t.outcomeId = ''; }
    }));
  }
  // Create the Outcome and save its Task in a single validated, atomic file replacement.
  for (const update of [false, true]) {
    const taskSchema = itemSchema('task');
    const taskBody = update ? taskSchema : { ...taskSchema, required: taskSchema.required.filter(key => key !== 'id'), properties: { ...taskSchema.properties, id: { type: 'string' } } };
    app.route<{ Body: { task: Task; newOutcomeName: string }; Params: { id: string } }>({
      method: update ? 'PUT' : 'POST', url: update ? '/api/tasks/with-outcome/:id' : '/api/tasks/with-outcome',
      schema: { body: { type: 'object', definitions: schema.definitions, additionalProperties: false, required: ['task', 'newOutcomeName'], properties: { task: taskBody, newOutcomeName: { type: 'string', minLength: 1, pattern: '\\S' } } } },
      handler: async request => store.change(data => {
        const name = request.body.newOutcomeName.trim();
        if (data.outcomes.some(o => o.name.trim() === name)) throw new DataError(['同名のOutcomeがあります。再読み込みして既存のOutcomeを選択してください。'], 409);
        if (request.body.task.outcomeId) throw new DataError(['新規Outcomeと既存Outcomeを同時には指定できません。']);
        const index = update ? data.tasks.findIndex(t => t.id === request.params.id) : -1;
        if (update && index < 0) throw new DataError(['対象データが見つかりません。再読み込みしてください。'], 404);
        const outcome = newOutcome(name, randomUUID());
        const task = { ...request.body.task, id: update ? request.params.id : randomUUID(), outcomeId: outcome.id };
        data.outcomes.push(outcome);
        if (update) data.tasks[index] = task; else data.tasks.push(task);
      }),
    });
  }
  app.put<{ Body: Data['settings'] }>('/api/settings', { schema: { body: schema.properties.settings } }, async request => store.change(data => { data.settings = request.body; }));
  if (staticRoot) { await app.register(fastifyStatic, { root: resolve(staticRoot) }); }
  return app;
}
