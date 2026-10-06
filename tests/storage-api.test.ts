import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, writeFile, unlink, rm, readdir, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store.js';
import { createApp } from '../src/server/app.js';
import { emptyData, newTask, newOutcome, type Data } from '../src/shared/model.js';
vi.mock('node:fs/promises', async importOriginal => { const original = await importOriginal<typeof import('node:fs/promises')>(); return { ...original, rename: vi.fn(original.rename) }; });
let directory: string, store: Store, app: Awaited<ReturnType<typeof createApp>>;
const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown, headers = {}) => app.inject({ method, url, payload: payload as object, headers: { host: 'localhost', ...headers } });
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'taskotter-test-')); store = new Store(directory); await store.initialize(); app = await createApp(store); });
afterEach(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });
describe('storage and API', () => {
  it('initializes only explicitly and never overwrites an existing file', async () => {
    const before = await readFile(store.file, 'utf8'); await expect(store.initialize()).rejects.toThrow(); expect(await readFile(store.file, 'utf8')).toBe(before);
    await unlink(store.file); expect((await call('GET', '/api/data')).statusCode).toBe(503); expect((await readdir(directory))).toEqual([]);
  });
  it('creates server IDs even for empty client IDs and persists across new Store instances', async () => {
    const response = await call('POST', '/api/tasks', newTask('名前だけ')); expect(response.statusCode).toBe(200);
    const data: Data = response.json(); expect(data.tasks[0].id).toMatch(/^[\da-f-]{36}$/); expect(data.tasks[0].status).toBe('Inbox'); expect(await new Store(directory).read()).toEqual(data);
  });
  it('reads external changes and does not lose unrelated data when applying an operation', async () => {
    const response = await call('POST', '/api/tasks', newTask('最初')); const original = response.json().tasks[0];
    const external = await store.read(); external.tasks.push(newTask('外部追加', 'external')); await writeFile(store.file, JSON.stringify(external));
    expect((await call('GET', '/api/data')).json().tasks).toHaveLength(2);
    const changed = await call('PUT', `/api/tasks/${original.id}`, { ...original, name: '後の保存が優先' }); expect(changed.json().tasks.map((t: { name: string }) => t.name)).toEqual(['後の保存が優先', '外部追加']);
  });
  it.each(['{"tasks":', JSON.stringify({ ...emptyData(), schemaVersion: 2 }), JSON.stringify({ ...emptyData(), tasks: [{ ...newTask('Task', 't'), outcomeId: 'missing' }] })])('locks invalid files and preserves original bytes: %s', async invalid => {
    await writeFile(store.file, invalid); expect((await call('GET', '/api/data')).statusCode).toBe(422);
    for (const [method, url, payload] of [['POST', '/api/tasks', newTask('Task')], ['PUT', '/api/settings', { timeStep: 30 }], ['DELETE', '/api/tasks/id', undefined]] as const) expect((await call(method, url, payload)).statusCode).toBe(422);
    expect(await readFile(store.file, 'utf8')).toBe(invalid); await writeFile(store.file, JSON.stringify(emptyData())); expect((await call('POST', '/api/tasks', newTask('復旧'))).statusCode).toBe(200);
  });
  it('serializes simultaneous writes', async () => {
    const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => call('POST', '/api/tasks', newTask(`Task ${i}`)))); expect(responses.every(r => r.statusCode === 200)).toBe(true);
    expect((await store.read()).tasks).toHaveLength(20); expect(await readdir(directory)).toEqual(['taskotter.json']);
  });
  it('keeps original data and cleans temporary files when rename fails', async () => {
    const original = await readFile(store.file, 'utf8');
    // Fault injection uses the real fs API except the atomic replacement.
    vi.mocked(rename).mockRejectedValueOnce(new Error('simulated mount failure'));
    try { await expect(store.change(d => d.tasks.push(newTask('Task', 't')))).rejects.toThrow(/mount failure/); }
    finally { vi.mocked(rename).mockClear(); }
    expect(await readFile(store.file, 'utf8')).toBe(original); expect(await readdir(directory)).toEqual(['taskotter.json']);
  });
  it('enforces manual Outcome completion, automatically clears it on reopen/link, and detaches on delete', async () => {
    let d = (await call('POST', '/api/outcomes', newOutcome('Outcome'))).json() as Data; const o = d.outcomes[0];
    d = (await call('POST', '/api/tasks', { ...newTask('Task'), outcomeId: o.id })).json(); const t = d.tasks[0];
    expect((await call('PUT', `/api/outcomes/${o.id}`, { ...o, complete: true })).statusCode).toBe(422);
    d = (await call('PUT', `/api/tasks/${t.id}`, { ...t, status: 'Done' })).json(); expect(d.outcomes[0].complete).toBe(false);
    d = (await call('PUT', `/api/outcomes/${o.id}`, { ...o, complete: true })).json(); expect(d.outcomes[0].complete).toBe(true);
    d = (await call('PUT', `/api/tasks/${t.id}`, { ...t, status: 'Doing' })).json(); expect(d.outcomes[0].complete).toBe(false);
    await call('PUT', `/api/tasks/${t.id}`, { ...t, status: 'Done' }); await call('PUT', `/api/outcomes/${o.id}`, { ...o, complete: true });
    d = (await call('POST', '/api/tasks', { ...newTask('新しいTask'), outcomeId: o.id })).json(); expect(d.outcomes[0].complete).toBe(false);
    d = (await call('DELETE', `/api/outcomes/${o.id}`)).json(); expect(d.outcomes).toHaveLength(0); expect(d.tasks).toHaveLength(2); expect(d.tasks.every(t => t.outcomeId === '')).toBe(true);
  });
  it('rejects unknown fields and type coercion without altering disk', async () => {
    expect((await call('POST', '/api/tasks', { ...newTask('Task'), injected: true })).statusCode).toBe(400);
    expect((await call('PUT', '/api/settings', { timeStep: '30' })).statusCode).toBe(400); expect((await store.read()).settings.timeStep).toBe(15);
  });
  it('rejects hostile origin/host requests and disables API caching', async () => {
    expect((await call('GET', '/api/data', undefined, { host: 'attacker.example' })).statusCode).toBe(403);
    expect((await call('POST', '/api/tasks', newTask('Task'), { origin: 'https://evil.example' })).statusCode).toBe(403);
    expect((await call('POST', '/api/tasks', newTask('Task'), { origin: 'http://localhost:9999' })).statusCode).toBe(403);
    expect((await call('GET', '/api/data')).headers['cache-control']).toBe('no-store');
  });
  it('returns 404 for missing targets and leaves valid data unchanged', async () => { expect((await call('PUT', '/api/tasks/missing', newTask('Task', 'missing'))).statusCode).toBe(404); expect((await store.read()).tasks).toEqual([]); });
  it('atomically creates an Outcome and Task, or links an updated Task to a new Outcome', async () => {
    let response = await call('POST', '/api/tasks/with-outcome', { task: newTask('新Task'), newOutcomeName: '  新Outcome  ' });
    expect(response.statusCode).toBe(200);
    let data = response.json() as Data;
    expect(data.outcomes[0]).toMatchObject({ name: '新Outcome', complete: false, start: '', end: '' });
    expect(data.tasks[0].outcomeId).toBe(data.outcomes[0].id);
    response = await call('PUT', `/api/tasks/with-outcome/${data.tasks[0].id}`, { task: { ...data.tasks[0], outcomeId: '' }, newOutcomeName: '別Outcome' });
    expect(response.statusCode).toBe(200); data = response.json(); expect(data.tasks).toHaveLength(1); expect(data.outcomes).toHaveLength(2); expect(data.tasks[0].outcomeId).toBe(data.outcomes[1].id);
  });
  it('leaves no orphan Outcome after invalid Task, missing target, duplicate name or failed write', async () => {
    const original = await readFile(store.file, 'utf8');
    expect((await call('POST', '/api/tasks/with-outcome', { task: { ...newTask('Task'), next: '2026-10-02T10:00' }, newOutcomeName: '孤立しない' })).statusCode).toBe(422);
    expect((await call('PUT', '/api/tasks/with-outcome/missing', { task: newTask('Task', 'missing'), newOutcomeName: '孤立しない' })).statusCode).toBe(404);
    vi.mocked(rename).mockRejectedValueOnce(new Error('simulated mount failure'));
    expect((await call('POST', '/api/tasks/with-outcome', { task: newTask('Task'), newOutcomeName: '孤立しない' })).statusCode).toBe(500);
    expect(await readFile(store.file, 'utf8')).toBe(original);
    await call('POST', '/api/outcomes', newOutcome('同名')); const before = await readFile(store.file, 'utf8');
    expect((await call('POST', '/api/tasks/with-outcome', { task: newTask('Task'), newOutcomeName: ' 同名 ' })).statusCode).toBe(409);
    expect(await readFile(store.file, 'utf8')).toBe(before);
  });

});

describe('task detail extensions', () => {
  it('reads legacy tasks without changing their file, and preserves details through ordinary updates', async () => {
    const legacy = newTask('旧Task', 'legacy'); delete legacy.materials; delete legacy.chats; delete legacy.subtasks; delete legacy.nextAction;
    await writeFile(store.file, JSON.stringify({ ...emptyData(), tasks: [legacy] }));
    const bytes = await readFile(store.file, 'utf8');
    expect((await call('GET', '/api/data')).statusCode).toBe(200);
    expect(await readFile(store.file, 'utf8')).toBe(bytes);
    const details = { ...legacy, memo: '# Markdown\n\n**メモ**', nextAction: '課題を分類',
      subtasks: [{ id: 's', name: '確認する', complete: true }],
      materials: [{ id: 'm', url: 'C:\\Users\\User\\資料 [test]\\報告.xlsx', summary: 'ローカル資料' }],
      chats: [{ id: 'c', url: 'https://teams.microsoft.com/l/message/test', summary: '相談' }] };
    expect((await call('PUT', '/api/tasks/legacy', details)).statusCode).toBe(200);
    expect((await new Store(directory).read()).tasks[0]).toMatchObject(details);
    expect((await call('PUT', '/api/tasks/legacy', { ...details, status: 'Doing' })).json().tasks[0].materials).toEqual(details.materials);
    expect((await store.read()).tasks[0].status).toBe('Doing'); // Completing a checklist does not complete its Task.
  });
  it.each(['javascript:alert(1)', 'data:text/html,test', 'https://', 'relative/path'])('rejects unusable reference targets without touching the file: %s', async url => {
    const before = await readFile(store.file, 'utf8');
    expect((await call('POST', '/api/tasks', { ...newTask('Task'), materials: [{ id: 'm', url, summary: '' }] })).statusCode).toBe(422);
    expect(await readFile(store.file, 'utf8')).toBe(before);
  });
  it('rejects invalid nested records and duplicate IDs, including externally edited files', async () => {
    expect((await call('POST', '/api/tasks', { ...newTask('Task'), subtasks: [{ id: 's', name: '   ', complete: false }] })).statusCode).toBe(400);
    expect((await call('POST', '/api/tasks', { ...newTask('Task'), chats: [{ id: 'c', url: 'https://example.com', summary: '', injected: true }] })).statusCode).toBe(400);
    const bad = { ...newTask('Task', 't'), subtasks: [{ id: 's', name: 'A', complete: false }, { id: 's', name: 'B', complete: false }] };
    expect((await call('POST', '/api/tasks', bad)).statusCode).toBe(422);
    await writeFile(store.file, JSON.stringify({ ...emptyData(), tasks: [bad] }));
    const before = await readFile(store.file, 'utf8');
    expect((await call('GET', '/api/data')).statusCode).toBe(422);
    expect((await call('PUT', '/api/settings', { timeStep: 30 })).statusCode).toBe(422);
    expect(await readFile(store.file, 'utf8')).toBe(before);
  });
  it('saves all detail fields when atomically creating an Outcome', async () => {
    const task = { ...newTask('Task'), materials: [{ id: 'm', url: 'https://example.com', summary: '資料' }], nextAction: '整理する' };
    const result = await call('POST', '/api/tasks/with-outcome', { task, newOutcomeName: '成果' });
    expect(result.statusCode).toBe(200); const data: Data = result.json();
    expect(data.tasks[0].materials).toEqual(task.materials); expect(data.tasks[0].outcomeId).toBe(data.outcomes[0].id);
  });
});

describe('completion history and legacy Outcome compatibility', () => {
  it('persists the previous status across completion, reload and clients omitting history', async () => {
    let data = (await call('POST', '/api/tasks', { ...newTask('復元Task'), status: 'Waiting' })).json() as Data;
    const task = data.tasks[0];
    data = (await call('PUT', `/api/tasks/${task.id}`, { ...task, status: 'Done' })).json();
    expect(data.tasks[0].previousStatus).toBe('Waiting');
    expect((await new Store(directory).read()).tasks[0].previousStatus).toBe('Waiting');
    data = (await call('PUT', `/api/tasks/${task.id}`, { ...task, status: 'Doing' })).json();
    expect(data.tasks[0].previousStatus).toBe('Waiting');
    data = (await call('PUT', `/api/tasks/${task.id}`, { ...task, status: 'Done' })).json();
    expect(data.tasks[0].previousStatus).toBe('Doing');
    expect((await call('PUT', `/api/tasks/${task.id}`, { ...task, previousStatus: 'Done' })).statusCode).toBe(400);
  });
  it('reads legacy priority without rewriting and creates Outcomes without priority', async () => {
    const legacy = { ...newOutcome('旧Outcome', 'legacy'), priority: 'High' as const };
    await writeFile(store.file, JSON.stringify({ ...emptyData(), outcomes: [legacy] }));
    const bytes = await readFile(store.file, 'utf8');
    expect((await call('GET', '/api/data')).json().outcomes[0].priority).toBe('High');
    expect(await readFile(store.file, 'utf8')).toBe(bytes);
    const data = (await call('POST', '/api/outcomes', newOutcome('新Outcome'))).json();
    expect(data.outcomes[1]).not.toHaveProperty('priority');
    expect(data.outcomes[0].priority).toBe('High');
  });
});

describe('automatic timestamps and concise update history', () => {
  it('creates timestamps and history centrally, ignoring supplied metadata', async () => {
    const fake = { createdAt: '2000-01-01T00:00:00Z', updatedAt: '2000-01-01T00:00:00Z', history: [{ at: '2000-01-01T00:00:00Z', summary: '偽の履歴' }] };
    for (const [kind, item] of [['tasks', newTask('Task')], ['outcomes', newOutcome('Outcome')]] as const) {
      const response = await call('POST', `/api/${kind}`, { ...item, ...fake }); expect(response.statusCode).toBe(200);
      const saved = response.json()[kind].at(-1);
      expect(saved.createdAt).toMatch(/Z$/); expect(saved.createdAt).not.toBe(fake.createdAt); expect(saved.updatedAt).toBe(saved.createdAt);
      expect(saved.history).toEqual([{ at: saved.createdAt, summary: `${kind === 'tasks' ? 'Task' : 'Outcome'}を作成` }]);
    }
  });
  it('preserves metadata when omitted or forged, and does not record an unchanged save', async () => {
    const task = (await call('POST', '/api/tasks', newTask('Task'))).json().tasks[0];
    const bytes = await readFile(store.file, 'utf8');
    const { createdAt, updatedAt, history, ...body } = task;
    expect((await call('PUT', `/api/tasks/${task.id}`, body)).json().tasks[0]).toEqual(task);
    expect(await readFile(store.file, 'utf8')).toBe(bytes);
    const result = (await call('PUT', `/api/tasks/${task.id}`, { ...body, createdAt: '2000-01-01T00:00:00Z', history: [], status: 'Doing', memo: '大量の本文'.repeat(5000) })).json().tasks[0];
    expect(result.createdAt).toBe(createdAt); expect(result.history).toHaveLength(2);
    expect(result.history[1].summary).toBe('メモを変更、ステータス：Inbox → Doing');
    expect(result.history[1].summary).not.toContain('大量の本文'); expect(result.updatedAt).toBe(result.history[1].at);
    expect((await new Store(directory).read()).tasks[0]).toEqual(result);
  });
  it('reads legacy data without writing or fabricating a creation date', async () => {
    const legacy = { ...emptyData(), tasks: [newTask('旧Task', 't')], outcomes: [newOutcome('旧Outcome', 'o')] };
    await writeFile(store.file, JSON.stringify(legacy)); const bytes = await readFile(store.file, 'utf8');
    expect((await call('GET', '/api/data')).json()).toEqual(legacy); expect(await readFile(store.file, 'utf8')).toBe(bytes);
    expect((await call('PUT', '/api/tasks/t', legacy.tasks[0])).json().tasks[0]).not.toHaveProperty('history');
    const task = (await call('PUT', '/api/tasks/t', { ...legacy.tasks[0], due: '2028-02-29' })).json().tasks[0];
    expect(task).not.toHaveProperty('createdAt'); expect(task.history).toHaveLength(1); expect(task.history[0].summary).toBe('締切日：未設定 → 2028/2/29(火)');
  });
  it('treats empty optional fields as unchanged when saving a legacy record', async () => {
    const legacy = newTask('Task', 't'); delete legacy.materials; delete legacy.chats; delete legacy.subtasks; delete legacy.nextAction;
    await writeFile(store.file, JSON.stringify({ ...emptyData(), tasks: [legacy] }));
    const task = (await call('PUT', '/api/tasks/t', { ...legacy, materials: [], chats: [], subtasks: [], nextAction: '' })).json().tasks[0];
    expect(task).not.toHaveProperty('history'); expect(task).not.toHaveProperty('updatedAt');
  });
  it('records item changes, completion and order without long reference contents', async () => {
    let task = (await call('POST', '/api/tasks', { ...newTask('Task'), materials: [{ id: 'a', url: 'https://example.com/a', summary: 'a' }, { id: 'b', url: 'https://example.com/b', summary: 'b' }], subtasks: [{ id: 's', name: '調査', complete: false }] })).json().tasks[0];
    task = (await call('PUT', `/api/tasks/${task.id}`, { ...task, materials: [{ ...task.materials[0], url: 'https://example.com/new', summary: '説明'.repeat(2000) }, task.materials[1]], subtasks: [{ ...task.subtasks[0], complete: true }] })).json().tasks[0];
    expect(task.history.at(-1).summary).toBe('資料のリンク先を1件変更、資料の概要を1件変更、サブタスクを1件完了');
    task = (await call('PUT', `/api/tasks/${task.id}`, { ...task, materials: [...task.materials].reverse() })).json().tasks[0]; expect(task.history.at(-1).summary).toBe('資料の順序を変更');
    task = (await call('PUT', `/api/tasks/${task.id}`, { ...task, materials: [task.materials[0]], chats: [{ id: 'c', url: 'https://example.com/chat', summary: '' }] })).json().tasks[0];
    expect(task.history.at(-1).summary).toBe('資料を1件削除、関連チャットを1件追加');
  });
  it('records automatic parent completion clear and unlink on deletion', async () => {
    let data = (await call('POST', '/api/outcomes', { ...newOutcome('Outcome'), complete: true })).json() as Data; const outcome = data.outcomes[0];
    data = (await call('POST', '/api/tasks', { ...newTask('Task'), outcomeId: outcome.id })).json(); const task = data.tasks[0];
    expect(data.outcomes[0].history?.at(-1)?.summary).toBe('完了：完了 → 未完了');
    expect(data.outcomes[0].updatedAt).toBe(task.createdAt);
    data = (await call('DELETE', `/api/outcomes/${outcome.id}`)).json();
    expect(data.tasks[0].history?.at(-1)?.summary).toBe('Outcome：Outcome → Outcomeなし'); expect(data.tasks[0].outcomeId).toBe('');
  });
  it('records combined creation in the same commit and settings changes leave history alone', async () => {
    const data = (await call('POST', '/api/tasks/with-outcome', { task: newTask('Task'), newOutcomeName: 'Outcome' })).json() as Data;
    expect(data.tasks[0].createdAt).toBe(data.outcomes[0].createdAt);
    expect(data.tasks[0].history?.[0].summary).toBe('Taskを作成'); expect(data.outcomes[0].history?.[0].summary).toBe('Outcomeを作成');
    const changed = (await call('PUT', '/api/settings', { timeStep: 30 })).json(); expect(changed.tasks).toEqual(data.tasks); expect(changed.outcomes).toEqual(data.outcomes);
  });
  it('does not commit history after a failed write or a rejected update', async () => {
    const task = (await call('POST', '/api/tasks', newTask('Task'))).json().tasks[0]; const bytes = await readFile(store.file, 'utf8');
    vi.mocked(rename).mockRejectedValueOnce(new Error('failure'));
    expect((await call('PUT', `/api/tasks/${task.id}`, { ...task, name: '更新' })).statusCode).toBe(500); expect(await readFile(store.file, 'utf8')).toBe(bytes);
    expect((await call('PUT', `/api/tasks/${task.id}`, { ...task, start: '2026-10-06', end: '' })).statusCode).toBe(422); expect(await readFile(store.file, 'utf8')).toBe(bytes);
    expect((await call('POST', '/api/tasks', { ...newTask('Task'), updatedAt: 'not-a-date' })).statusCode).toBe(400);
  });
});
