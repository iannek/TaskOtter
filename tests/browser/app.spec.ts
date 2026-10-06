import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { emptyData, newTask, newOutcome, localDate, addDays, dateLabel } from '../../src/shared/model.js';
let file: string;
async function go(page: Page, name: string) { await page.locator('.sidebar').getByRole('button', { name, exact: true }).click(); await expect(page.getByRole('heading', { name, exact: true })).toBeVisible(); }
async function chooseDate(page: Page, label: string, day: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  const picker = page.getByRole('dialog', { name: `${label}を選択`, exact: true });
  const header = (await picker.locator('.date-picker-head strong').innerText()).match(/(\d+)年 (\d+)月/)!;
  const distance = (Number(day.slice(0, 4)) - Number(header[1])) * 12 + Number(day.slice(5, 7)) - Number(header[2]);
  for (let i = 0; i < Math.abs(distance); i++) await picker.getByRole('button', { name: distance < 0 ? '前の月' : '次の月', exact: true }).click();
  await picker.getByRole('button', { name: day, exact: true }).click();
}
async function save(page: Page) { await page.getByRole('button', { name: /^(作成|保存)$/ }).click(); await expect(page.locator('dialog')).toHaveCount(0); }
test.beforeEach(async () => { const directory = await readFile('test-results/data-directory.txt', 'utf8'); file = join(directory, 'taskotter.json'); await writeFile(file, JSON.stringify(emptyData())); });
test('quick add, edit, persistence, categories and deletion', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await go(page, 'Task・Outcome'); await page.getByLabel('Taskをすばやく追加').fill('最初のTask'); await page.getByRole('button', { name: '追加', exact: true }).click();
  await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '最初のTask', exact: true }).click();
  await page.getByRole('button', { name: 'カテゴリ', exact: true }).click(); await page.getByRole('button', { name: '＋ 新しいカテゴリを作成', exact: true }).click(); await page.getByLabel('新しいカテゴリ名').fill('自由カテゴリ'); await page.getByRole('button', { name: 'このカテゴリを使う', exact: true }).click(); await page.getByLabel('ステータス', { exact: true }).selectOption('Doing'); await page.getByRole('tab', { name: 'メモ', exact: true }).click(); await page.getByRole('textbox', { name: 'メモ', exact: true }).fill('<script>window.evil=true</script>'); await save(page);
  await page.reload(); await go(page, 'Task・Outcome'); await expect(page.getByRole('cell', { name: '自由カテゴリ', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '最初のTask', exact: true }).click(); await page.getByRole('tab', { name: 'メモ', exact: true }).click(); await expect(page.getByRole('textbox', { name: 'メモ', exact: true })).toHaveValue('<script>window.evil=true</script>');
  page.on('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: '削除', exact: true }).click(); await expect(page.locator('dialog')).toHaveCount(0); expect(JSON.parse(await readFile(file, 'utf8')).tasks).toHaveLength(0); expect(errors).toEqual([]);
});
test('create Outcome and scheduled Task, popups, warnings and all calendar modes', async ({ page }) => {
  const day = localDate(); await page.goto('/'); await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '＋ Outcome', exact: true }).click();
  await page.getByLabel('Outcome名', { exact: true }).fill('成果'); await chooseDate(page, '期間開始日', day); await chooseDate(page, '期間終了日', addDays(day, 3)); await save(page);
  await page.getByRole('button', { name: '＋ Task' }).click(); await page.getByLabel('Task名', { exact: true }).fill('予定Task'); await page.getByRole('button', { name: 'Outcome', exact: true }).click(); await page.getByRole('button', { name: '成果 · 進行中', exact: true }).click();
  await chooseDate(page, '期間開始日', addDays(day, -1)); await expect(page.getByText('⚠ Outcomeの期間からはみ出しています。保存は可能です。')).toBeVisible();
  await chooseDate(page, '締切日', day); await chooseDate(page, '次の対応予定（日付）', day);
  await page.getByRole('button', { name: '開始時刻', exact: true }).click(); await page.getByRole('button', { name: '09:15', exact: true }).click();
  await page.getByRole('button', { name: '終了時刻', exact: true }).click(); await page.getByRole('button', { name: '10:30', exact: true }).click(); await save(page);
  await page.screenshot({ path: 'test-results/taskotter-editor-result.png', fullPage: true });
  await go(page, 'ガントチャート'); await expect(page.locator('.bar.warn')).toHaveCount(1);
  await go(page, 'カレンダー'); await expect(page.locator('.schedule-day-track')).toHaveCount(7); await page.getByRole('button', { name: '月', exact: true }).click(); await expect(page.locator('.cal-event')).toHaveCount(2); await page.getByRole('button', { name: '週', exact: true }).click(); await expect(page.locator('.schedule-day-track')).toHaveCount(7); await expect(page.locator('.schedule-event')).toHaveCount(1);
  await page.getByRole('button', { name: '日', exact: true }).click(); await expect(page.locator('.schedule-day-track')).toHaveCount(1);
  await page.getByLabel('時刻の選択間隔').selectOption('30'); await expect(page.getByRole('status')).toContainText('設定を保存'); expect(JSON.parse(await readFile(file, 'utf8')).settings.timeStep).toBe(30);
});
test('Outcome completion and automatic clear when Task is reopened', async ({ page }) => {
  const d = emptyData(); d.outcomes.push(newOutcome('成果', 'o')); d.tasks.push({ ...newTask('Task', 't'), outcomeId: 'o' }); await writeFile(file, JSON.stringify(d));
  await page.goto('/'); await go(page, 'Task・Outcome'); await page.getByLabel('Doneも表示').check(); await page.getByRole('button', { name: '成果', exact: true }).click(); await expect(page.getByLabel('完了', { exact: true })).toBeDisabled(); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.getByRole('button', { name: 'Task', exact: true }).click(); await page.getByLabel('ステータス', { exact: true }).selectOption('Done'); await save(page);
  await page.getByRole('button', { name: '成果', exact: true }).click(); await page.getByLabel('完了', { exact: true }).check(); await save(page);
  await page.getByRole('button', { name: 'Task', exact: true }).click(); await page.getByLabel('ステータス', { exact: true }).selectOption('Inbox'); await save(page); expect(JSON.parse(await readFile(file, 'utf8')).outcomes[0].complete).toBe(false);
});
test('external malformed data locks editing without changing file, and repair restores it', async ({ page }) => {
  await page.goto('/'); await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '＋ Task' }).click(); await page.getByLabel('Task名', { exact: true }).fill('保存できない');
  await writeFile(file, '{"invalid":'); await page.getByRole('button', { name: '作成', exact: true }).click(); await expect(page.getByRole('button', { name: '作成', exact: true })).toBeDisabled(); expect(await readFile(file, 'utf8')).toBe('{"invalid":');
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('JSON構文エラー'); await expect(page.getByRole('button', { name: '＋ Task' })).toBeDisabled();
  const repaired = emptyData(); repaired.tasks.push(newTask('AIから追加', 'external')); await writeFile(file, JSON.stringify(repaired)); await page.getByRole('button', { name: '再読み込み' }).click(); await expect(page.getByRole('button', { name: '＋ Task' })).toBeEnabled(); await go(page, 'Task・Outcome'); await expect(page.getByRole('button', { name: 'AIから追加', exact: true })).toBeVisible();
});
test('500 Tasks load and switch screens in under 5 seconds', async ({ page }) => {
  const d = emptyData(), day = localDate();
  d.outcomes = Array.from({ length: 20 }, (_, i) => ({ ...newOutcome(`成果 ${i}`, `o${i}`), start: day, end: addDays(day, 7) }));
  d.tasks = Array.from({ length: 500 }, (_, i) => ({ ...newTask(`Task ${i}`, `t${i}`), outcomeId: `o${i % 20}`, start: day, end: addDays(day, 3), due: day, next: `${day}T09:00`, nextEnd: '10:00' }));
  await writeFile(file, JSON.stringify(d)); const timings: Record<string, number> = {}; let start = performance.now(); await page.goto('/'); await go(page, 'Task・Outcome'); await expect(page.locator('.child-row')).toHaveCount(500); timings.initial = performance.now() - start;
  for (const name of ['Task・Outcome', 'ガントチャート', 'カレンダー', 'ダッシュボード']) { start = performance.now(); await go(page, name); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); timings[name] = performance.now() - start; }
  for (const elapsed of Object.values(timings)) expect(elapsed).toBeLessThan(5000); console.log('500 Task timings (ms):', JSON.stringify(timings)); await writeFile('test-results/performance.json', JSON.stringify(timings, null, 2));
});
test('filters and cards preserve hierarchy, dashboard includes past schedules, and calendar separates overlap', async ({ page }) => {
  const day = localDate(), past = addDays(day, -2), d = emptyData();
  d.outcomes = [newOutcome('空の未完了Outcome', 'open'), { ...newOutcome('空の完了Outcome', 'done'), complete: true }, newOutcome('親Outcome', 'parent')];
  d.tasks = [
    { ...newTask('最古の予定', 'a'), category: 'カテゴリA', outcomeId: 'parent', start: 'before', end: 'after', next: `${past}T10:00`, nextEnd: '11:00' },
    { ...newTask('今日の予定1', 'b'), category: 'カテゴリB', status: 'Doing', start: day, end: day, next: `${day}T09:00`, nextEnd: '10:00' },
    { ...newTask('今日の予定2', 'c'), status: 'Someday', next: `${day}T09:15`, nextEnd: '10:30' },
    { ...newTask('完了Task', 'finished'), status: 'Done', due: day },
  ];
  await writeFile(file, JSON.stringify(d)); await page.goto('/'); await expect(page.locator('.metric-number')).toHaveText(['2', '2', '1']);
  await expect(page.locator('.grid-2 .panel').first().locator('.row-title').first()).toHaveText('最古の予定'); await chooseDate(page, '予定の絞り込み開始日', day); await expect(page.locator('.grid-2 .panel').first().locator('.task-row')).toHaveCount(2);
  await go(page, 'Task・Outcome'); await page.getByRole('tab', { name: 'Outcomeカード' }).click(); await expect(page.locator('.outcome-card')).toHaveCount(4); await expect(page.locator('.outcome-card').nth(2)).toContainText('最古の予定'); await page.getByRole('tab', { name: '階層一覧' }).click();
  await page.getByLabel('Taskのカテゴリ').selectOption('カテゴリA'); await expect(page.locator('.child-row')).toHaveCount(1); await page.getByLabel('Task名を検索').fill('該当なし'); await expect(page.locator('.child-row')).toHaveCount(0);
  await go(page, 'ガントチャート'); await page.getByLabel('ガントのステータス').selectOption('Waiting'); await expect(page.locator('.gantt-label.parent')).toHaveCount(3); await expect(page.locator('.gantt-label.parent')).toContainText(['空の未完了Outcome', '親Outcome', 'Outcomeなし']);
  await go(page, 'カレンダー'); await page.getByRole('button', { name: '月', exact: true }).click(); await expect(page.locator('.cal-event.due')).toHaveCount(0); await page.getByLabel('Doneも表示').check(); await expect(page.locator('.cal-event.due')).toHaveCount(1); await page.getByRole('button', { name: '日', exact: true }).click(); await expect(page.locator('.schedule-event')).toHaveCount(2);
  const positions = await page.locator('.schedule-event').evaluateAll(elements => elements.map(el => ({ left: el.getBoundingClientRect().left, width: el.getBoundingClientRect().width })));
  expect(positions[0].left).not.toBe(positions[1].left); expect(positions.every(p => p.width > 70)).toBe(true);
});
test('editor closes outside, resizes by dragging, and preserves its width while opening other records', async ({ page }) => {
  const d = emptyData(); d.tasks.push(newTask('調整するTask', 't')); await writeFile(file, JSON.stringify(d));
  await page.goto('/'); await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '調整するTask', exact: true }).click();
  const editor = page.locator('dialog.drawer'); await page.getByRole('tab', { name: 'メモ', exact: true }).click(); await page.getByRole('textbox', { name: 'メモ', exact: true }).fill('未保存のメモ'); await expect(editor).toBeVisible();
  const original = (await editor.boundingBox())!, handle = await page.getByRole('separator', { name: 'サイドバーの幅' }).boundingBox();
  await page.mouse.move(handle!.x + 4, 400); await page.mouse.down(); await page.mouse.move(handle!.x - 160, 400, { steps: 10 }); await page.mouse.up();
  const resized = (await editor.boundingBox())!; expect(resized.width).toBeGreaterThan(original.width + 150); await expect(page.getByRole('textbox', { name: 'メモ', exact: true })).toHaveValue('未保存のメモ');
  await page.mouse.click(100, 300); await expect(editor).toHaveCount(0); expect(JSON.parse(await readFile(file, 'utf8')).tasks[0].memo).toBe('');
  await page.getByRole('button', { name: '調整するTask', exact: true }).click(); expect((await editor.boundingBox())!.width).toBe(resized.width);
  const separator = page.getByRole('separator', { name: 'サイドバーの幅' }); await separator.focus(); await page.keyboard.press('ArrowLeft'); expect((await editor.boundingBox())!.width).toBe(resized.width + 20);
  await page.keyboard.press('Escape'); await expect(editor).toHaveCount(0);
});
test('whole-date picker selects, clears and filters dates; period placeholder and gantt labels match the request', async ({ page }) => {
  const d = emptyData(), day = localDate(); d.tasks.push({ ...newTask('日付Task', 't'), next: `${day}T10:00`, nextEnd: '11:00' }); await writeFile(file, JSON.stringify(d));
  await page.goto('/'); await chooseDate(page, '予定の絞り込み開始日', addDays(day, 1)); await expect(page.locator('.grid-2 .panel').first().locator('.task-row')).toHaveCount(0);
  await page.getByRole('button', { name: '予定の絞り込み開始日', exact: true }).click(); await page.getByRole('dialog', { name: '予定の絞り込み開始日を選択' }).getByRole('button', { name: '日付を解除', exact: true }).click();
  await expect(page.locator('.grid-2 .panel').first().locator('.task-row')).toHaveCount(1);
  await go(page, 'Task・Outcome'); await expect(page.locator('.child-row td').nth(3)).toHaveText('-'); await page.getByRole('button', { name: '日付Task', exact: true }).click();
  await expect(page.getByRole('button', { name: '期間開始日', exact: true })).toHaveText('-▦'); await expect(page.getByRole('button', { name: '期間終了日', exact: true })).toHaveText('-▦');
  await page.getByRole('button', { name: '締切日', exact: true }).click(); await expect(page.locator('dialog.drawer')).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.locator('.date-popover')).toHaveCount(0); await expect(page.locator('dialog.drawer')).toBeVisible();
  await chooseDate(page, '締切日', '2028-02-29'); await expect(page.getByRole('button', { name: '締切日', exact: true })).toHaveText('2028/2/29(火)▦');
  await save(page); expect(JSON.parse(await readFile(file, 'utf8')).tasks[0].due).toBe('2028-02-29');
  await go(page, 'ガントチャート'); const dates = await page.locator('.day-head strong').allTextContents(); expect(dates).toHaveLength(14); expect(dates).toContain(String(Number(day.slice(8)))); expect(dates.every(text => /^\d{1,2}$/.test(text))).toBe(true);
  await go(page, 'カレンダー'); await page.getByRole('button', { name: '週', exact: true }).click(); await expect(page.locator('.schedule-day-head strong')).toContainText([dateLabel(day)]);
});
test('sidebar padding, saved time step, and unclipped dismissible time pickers', async ({ page }) => {
  const d = emptyData(); d.settings.timeStep = 30; d.tasks.push(newTask('余白確認Task', 't')); await writeFile(file, JSON.stringify(d));
  await page.goto('/'); await expect(page.getByLabel('時刻の選択間隔')).toHaveValue('30');
  await page.getByLabel('時刻の選択間隔').selectOption('15'); await expect(page.getByRole('status')).toContainText('設定を保存');
  await page.reload(); await expect(page.getByLabel('時刻の選択間隔')).toHaveValue('15');
  await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '余白確認Task', exact: true }).click();
  const padding = await page.locator('.drawer-body').evaluate(el => ({ left: getComputedStyle(el).paddingLeft, right: getComputedStyle(el).paddingRight, top: getComputedStyle(el).paddingTop }));
  expect(padding).toEqual({ left: '27px', right: '27px', top: '24px' });
  for (const label of ['開始時刻', '終了時刻']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    const popup = page.getByRole('dialog', { name: label, exact: true });
    await expect(popup).toBeVisible(); await expect(popup.getByRole('button', { name: '00:15', exact: true })).toBeVisible();
    const fits = await popup.locator('.time-options').evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.scrollWidth <= el.clientWidth && [...el.children].every(child => { const b = child.getBoundingClientRect(); return b.left >= r.left && b.right <= r.right; });
    });
    expect(fits).toBe(true);
    await page.locator('.drawer-head h2').click(); await expect(popup).toHaveCount(0); await expect(page.locator('dialog.drawer')).toBeVisible();
  }
  await page.getByRole('button', { name: '開始時刻', exact: true }).click(); await page.keyboard.press('Escape');
  await expect(page.locator('.time-popover')).toHaveCount(0); await expect(page.locator('dialog.drawer')).toBeVisible();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: '＋ Task', exact: true }).click();
  await page.getByRole('button', { name: '終了時刻', exact: true }).click();
  const bounds = (await page.locator('.time-popover').boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(8); expect(bounds.x + bounds.width).toBeLessThanOrEqual(382);
  expect(await page.locator('.time-options').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('button', { name: '00:30', exact: true }).click(); await expect(page.getByRole('button', { name: '終了時刻', exact: true })).toHaveText('00:30');
});
test('category choices, new category cancellation and one-sided task periods', async ({ page }) => {
  const d = emptyData(), day = localDate(); d.tasks.push({ ...newTask('カテゴリTask', 't'), category: '既存カテゴリ' }, newTask('別Task', 'other')); await writeFile(file, JSON.stringify(d));
  await page.goto('/'); await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '別Task', exact: true }).click();
  await page.getByRole('button', { name: 'カテゴリ', exact: true }).click();
  await expect(page.getByRole('button', { name: '既存カテゴリ', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '既存カテゴリ', exact: true }).click(); await save(page);
  expect(JSON.parse(await readFile(file, 'utf8')).tasks[1].category).toBe('既存カテゴリ');
  await page.getByRole('button', { name: '別Task', exact: true }).click();
  await page.getByRole('button', { name: 'カテゴリ', exact: true }).click(); await page.getByRole('button', { name: '＋ 新しいカテゴリを作成', exact: true }).click();
  await page.getByLabel('新しいカテゴリ名').fill('未保存カテゴリ'); await page.getByRole('button', { name: 'このカテゴリを使う', exact: true }).click();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click(); expect(JSON.parse(await readFile(file, 'utf8')).tasks[1].category).toBe('既存カテゴリ');
  await page.getByRole('button', { name: '別Task', exact: true }).click(); await chooseDate(page, '期間開始日', day); await save(page);
  expect(JSON.parse(await readFile(file, 'utf8')).tasks[1]).toMatchObject({ start: day, end: 'after' });
  await page.getByRole('button', { name: '別Task', exact: true }).click();
  await page.getByRole('button', { name: '期間開始日', exact: true }).click(); await page.getByRole('dialog', { name: '期間開始日を選択' }).getByRole('button', { name: '日付を解除', exact: true }).click();
  await chooseDate(page, '期間終了日', day); await save(page);
  expect(JSON.parse(await readFile(file, 'utf8')).tasks[1]).toMatchObject({ start: 'before', end: day });
});
test('whole row opens details and inline fields save without opening the sidebar', async ({ page }) => {
  const d = emptyData(), day = localDate(); d.outcomes.push({ ...newOutcome('親', 'o'), complete: true });
  d.tasks.push({ ...newTask('行編集Task', 't'), status: 'Done', outcomeId: 'o', category: '行のカテゴリ' }); await writeFile(file, JSON.stringify(d));
  await page.goto('/'); await go(page, 'Task・Outcome'); await page.getByLabel('Doneも表示').check();
  await page.locator('.child-row td').nth(2).click(); await expect(page.locator('dialog.drawer')).toBeVisible(); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.getByLabel('行編集Taskのステータス', { exact: true }).selectOption('Doing');
  await expect(page.getByRole('status')).toContainText('保存しました'); await expect(page.locator('dialog.drawer')).toHaveCount(0);
  expect(JSON.parse(await readFile(file, 'utf8')).outcomes[0].complete).toBe(false);
  await page.getByRole('button', { name: '行編集Taskの対応予定期間を編集', exact: true }).click(); await chooseDate(page, '行内の期間終了日', day);
  const form = page.getByRole('form', { name: '行編集Taskの行内編集' }); await form.getByRole('button', { name: '保存', exact: true }).click(); await expect(form).toHaveCount(0);
  expect(JSON.parse(await readFile(file, 'utf8')).tasks[0]).toMatchObject({ start: 'before', end: day });
  await page.getByRole('button', { name: '行編集Taskの締切日を編集', exact: true }).click(); await chooseDate(page, '行内の締切日', day); await form.getByRole('button', { name: '保存', exact: true }).click(); await expect(form).toHaveCount(0);
  await page.getByRole('button', { name: '行編集Taskの次の対応予定を編集', exact: true }).click(); await chooseDate(page, '行内の予定日', day);
  await page.getByRole('button', { name: '行内の開始時刻', exact: true }).click(); await page.getByRole('button', { name: '10:00', exact: true }).click();
  await form.getByRole('button', { name: '保存', exact: true }).click(); await expect(form.getByRole('alert')).toHaveCount(0); await expect(page.getByRole('alert')).toContainText('すべて指定');
  await page.getByRole('button', { name: '行内の終了時刻', exact: true }).click(); await page.getByRole('button', { name: '11:00', exact: true }).click();
  await form.getByRole('button', { name: '保存', exact: true }).click(); await expect(form).toHaveCount(0);
  expect(JSON.parse(await readFile(file, 'utf8')).tasks[0]).toMatchObject({ status: 'Doing', due: day, next: `${day}T10:00`, nextEnd: '11:00' });
  await expect(page.locator('dialog.drawer')).toHaveCount(0);
  await page.getByRole('button', { name: '行編集Taskの対応予定期間を編集', exact: true }).click(); await form.getByRole('button', { name: '解除', exact: true }).click(); await form.getByRole('button', { name: '保存', exact: true }).click(); await expect(form).toHaveCount(0);
  expect(JSON.parse(await readFile(file, 'utf8')).tasks[0]).toMatchObject({ start: '', end: '' });
  await page.reload(); await go(page, 'Task・Outcome'); await expect(page.getByLabel('行編集Taskのステータス', { exact: true })).toHaveValue('Doing');
  await go(page, 'ガントチャート'); await page.locator('.task-track').click(); await expect(page.locator('dialog.drawer')).toBeVisible();
});
test('Outcome selection and atomic creation, matching fields, close placement and logo assets', async ({ page }) => {
  const d = emptyData(); d.outcomes.push({ ...newOutcome('完了Outcome', 'done'), complete: true }, newOutcome('既存Outcome', 'existing')); d.tasks.push(newTask('Outcome確認Task', 't')); await writeFile(file, JSON.stringify(d));
  await page.goto('/'); await expect(page.locator('.brand-logo img')).toBeVisible();
  expect(await page.locator('.brand-logo img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  const favicon = await page.locator('link[rel="icon"]').getAttribute('href'); expect(favicon).toBe('/taskotter-icon.svg'); expect((await page.request.get(favicon!)).status()).toBe(200);
  await go(page, 'Task・Outcome'); await page.getByRole('button', { name: 'Outcome確認Task', exact: true }).click();
  const status = (await page.getByLabel('ステータス', { exact: true }).boundingBox())!, category = (await page.getByRole('button', { name: 'カテゴリ', exact: true }).boundingBox())!;
  expect(status.width).toBe(category.width); expect(status.height).toBe(category.height);
  const editor = (await page.locator('dialog.drawer').boundingBox())!, close = (await page.getByRole('button', { name: '閉じる', exact: true }).boundingBox())!;
  expect(close.y - editor.y).toBe(16); expect(editor.x + editor.width - close.x - close.width).toBe(16);
  await page.getByRole('button', { name: 'Outcome', exact: true }).click(); await page.getByRole('button', { name: '＋ 新しいOutcomeを作成', exact: true }).click();
  await page.getByLabel('新しいOutcome名').fill('未保存Outcome'); await page.getByRole('button', { name: 'このOutcomeを使う', exact: true }).click();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click(); expect(JSON.parse(await readFile(file, 'utf8')).outcomes).toHaveLength(2);
  await page.getByRole('button', { name: 'Outcome確認Task', exact: true }).click(); await page.getByRole('button', { name: 'Outcome', exact: true }).click(); await page.getByRole('button', { name: '＋ 新しいOutcomeを作成', exact: true }).click();
  await page.getByLabel('新しいOutcome名').fill('既存Outcome'); await expect(page.getByRole('button', { name: 'このOutcomeを使う', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '既存Outcome · 進行中 · existing', exact: true }).click(); await save(page);
  expect(JSON.parse(await readFile(file, 'utf8')).tasks[0].outcomeId).toBe('existing');
  await page.getByRole('button', { name: 'Outcome確認Task', exact: true }).click(); await page.getByRole('button', { name: 'Outcome', exact: true }).click(); await page.getByRole('button', { name: '完了Outcome · 完了', exact: true }).click();
  await expect(page.getByText('このタスクを保存すると、選択したOutcomeの完了が解除されます。')).toBeVisible(); await save(page);
  expect(JSON.parse(await readFile(file, 'utf8')).outcomes[0].complete).toBe(false);
  await page.getByRole('button', { name: 'Outcome確認Task', exact: true }).click(); await page.getByRole('button', { name: 'Outcome', exact: true }).click(); await page.getByRole('button', { name: '＋ 新しいOutcomeを作成', exact: true }).click();
  await page.getByLabel('新しいOutcome名').fill('新しい成果'); await page.getByRole('button', { name: 'このOutcomeを使う', exact: true }).click(); await save(page);
  let saved = JSON.parse(await readFile(file, 'utf8')); expect(saved.outcomes).toHaveLength(3); expect(saved.tasks[0].outcomeId).toBe(saved.outcomes[2].id);
  await page.getByRole('button', { name: '＋ Task', exact: true }).click(); await page.getByLabel('Task名', { exact: true }).fill('同時作成Task');
  await page.getByRole('button', { name: 'Outcome', exact: true }).click(); await page.getByRole('button', { name: '＋ 新しいOutcomeを作成', exact: true }).click(); await page.getByLabel('新しいOutcome名').fill('同時作成Outcome'); await page.getByRole('button', { name: 'このOutcomeを使う', exact: true }).click(); await save(page);
  saved = JSON.parse(await readFile(file, 'utf8')); expect(saved.tasks).toHaveLength(2); expect(saved.tasks[1].outcomeId).toBe(saved.outcomes[3].id);
  await page.reload(); await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '同時作成Task', exact: true }).click(); await expect(page.getByRole('button', { name: 'Outcome', exact: true })).toContainText('同時作成Outcome');
});
test('new standalone Outcome excludes unassigned Tasks and cards open from their background', async ({ page }) => {
  const d = emptyData(); d.tasks.push(newTask('未分類Task', 't')); await writeFile(file, JSON.stringify(d));
  await page.goto('/'); await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '＋ Outcome', exact: true }).click();
  await expect(page.locator('.summary-box')).toContainText('紐づくTask 0件'); await expect(page.getByLabel('完了', { exact: true })).toBeEnabled();
  await page.getByLabel('Outcome名', { exact: true }).fill('独立Outcome'); await save(page);
  let saved = JSON.parse(await readFile(file, 'utf8')); expect(saved.tasks[0].outcomeId).toBe('');
  const colors = await page.locator('.table').evaluate(el => [getComputedStyle(el.querySelector('.group-row td')!).backgroundColor, getComputedStyle(el.querySelector('.child-row td')!).backgroundColor]); expect(colors[0]).not.toBe(colors[1]);
  await page.getByRole('tab', { name: 'Outcomeカード' }).click(); await expect(page.locator('.outcome-card').first()).toContainText('紐づくTaskなし');
  await page.locator('.outcome-card .outcome-meta').click(); await expect(page.getByLabel('Outcome名', { exact: true })).toHaveValue('独立Outcome'); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.locator('.outcome-card').first().focus(); await page.keyboard.press('Enter'); await expect(page.getByLabel('Outcome名', { exact: true })).toHaveValue('独立Outcome'); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  saved.tasks[0].outcomeId = saved.outcomes[0].id; await writeFile(file, JSON.stringify(saved)); await page.reload(); await go(page, 'Task・Outcome'); await page.getByRole('tab', { name: 'Outcomeカード' }).click();
  await page.getByRole('button', { name: '未分類Task', exact: true }).click(); await expect(page.getByLabel('Task名', { exact: true })).toHaveValue('未分類Task');
});
test('gantt switches week, fortnight, calendar month and custom ranges with correct bar scale', async ({ page }) => {
  const day = localDate(), d = emptyData(); d.outcomes.push({ ...newOutcome('期間Outcome', 'o'), start: day, end: addDays(day, 1) }); d.tasks.push({ ...newTask('期間Task', 't'), outcomeId: 'o', start: day, end: addDays(day, 1) }); await writeFile(file, JSON.stringify(d));
  await page.goto('/'); await go(page, 'ガントチャート'); await expect(page.locator('.day-head')).toHaveCount(14);
  const period = page.getByLabel('ガントの表示期間'); await period.selectOption('week'); await expect(page.locator('.day-head')).toHaveCount(7);
  const widths = await page.locator('.task-track').evaluate(el => ({ row: el.getBoundingClientRect().width, bar: el.querySelector('.bar')!.getBoundingClientRect().width }));
  const dayIndex = (new Date(`${day}T12:00`).getDay() + 6) % 7; expect(widths.bar / widths.row).toBeCloseTo(Math.min(2, 7 - dayIndex) / 7, 2);
  const colors = await page.locator('.gantt-shell').evaluate(el => [getComputedStyle(el.querySelector('.gantt-track.parent')!).backgroundColor, getComputedStyle(el.querySelector('.task-track')!).backgroundColor]); expect(colors[0]).not.toBe(colors[1]);
  await period.selectOption('month'); const current = new Date(`${day}T12:00`); const count = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate(); await expect(page.locator('.day-head')).toHaveCount(count);
  await period.selectOption('custom'); await chooseDate(page, 'ガントの表示開始日', '2028-02-28'); await chooseDate(page, 'ガントの表示終了日', '2028-03-01'); await page.getByRole('button', { name: '期間を適用', exact: true }).click();
  await expect(page.locator('.day-head strong')).toHaveText(['28', '29', '1']);
  await page.getByRole('button', { name: '次の期間', exact: true }).click(); await expect(page.locator('.day-head strong')).toHaveText(['2', '3', '4']);
  await chooseDate(page, 'ガントの表示終了日', '2028-03-01'); await page.getByRole('button', { name: '期間を適用', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('表示開始日以降'); await expect(page.locator('.day-head')).toHaveCount(3);
  await chooseDate(page, 'ガントの表示開始日', '2028-03-01'); await page.getByRole('button', { name: '期間を適用', exact: true }).click(); await expect(page.locator('.day-head')).toHaveCount(1);
  await page.getByRole('button', { name: '今日', exact: true }).click(); await expect(page.locator('.day-head strong')).toHaveText([String(Number(day.slice(8)))]);
});
test('Outcome rows open from empty space and Done Tasks are hidden until requested', async ({ page }) => {
  const d = emptyData(); d.outcomes.push(newOutcome('行全体Outcome', 'o')); d.tasks.push({ ...newTask('未完了のTask', 't'), outcomeId: 'o' }, { ...newTask('完了したTask', 'done'), status: 'Done', outcomeId: 'o' }); await writeFile(file, JSON.stringify(d));
  await page.goto('/'); await go(page, 'Task・Outcome'); await expect(page.locator('.child-row')).toHaveCount(1); await expect(page.getByRole('button', { name: '完了したTask', exact: true })).toHaveCount(0);
  await page.locator('.group-meta').first().click(); await expect(page.getByLabel('Outcome名', { exact: true })).toHaveValue('行全体Outcome'); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.locator('.group-row.clickable').first().focus(); await page.keyboard.press('Enter'); await expect(page.getByLabel('Outcome名', { exact: true })).toHaveValue('行全体Outcome'); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.getByLabel('Doneも表示').check(); await expect(page.locator('.child-row')).toHaveCount(2); await page.getByLabel('Doneも表示').uncheck(); await page.getByLabel('Taskのステータス', { exact: true }).selectOption('Done'); await expect(page.locator('.child-row')).toHaveCount(1); await expect(page.getByRole('button', { name: '完了したTask', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Outcomeカード' }).click(); await expect(page.locator('.outcome-card').getByRole('button', { name: '完了したTask', exact: true })).toHaveCount(0); await expect(page.locator('.outcome-footer')).toContainText('Task 1 / 2 Done');
  await page.getByLabel('Doneも表示').check(); await expect(page.locator('.outcome-card').getByRole('button', { name: '完了したTask', exact: true })).toBeVisible();
  await go(page, 'ガントチャート'); await page.locator('.outcome-label .gantt-task-name').click(); await expect(page.getByLabel('Outcome名', { exact: true })).toHaveValue('行全体Outcome'); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.locator('.outcome-track').click(); await expect(page.getByLabel('Outcome名', { exact: true })).toHaveValue('行全体Outcome');
});
test('month gantt fits all dates on desktop and exposes month end by scrolling on smaller screens', async ({ page }) => {
  await page.goto('/'); await go(page, 'ガントチャート'); await page.getByLabel('ガントの表示期間').selectOption('month');
  const date = new Date(), count = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); await expect(page.locator('.day-head')).toHaveCount(count);
  const fits = await page.locator('.gantt-shell').evaluate(el => { const r = el.getBoundingClientRect(), cells = el.querySelectorAll('.day-head'); return cells[0].getBoundingClientRect().left >= r.left && cells[cells.length - 1].getBoundingClientRect().right <= r.right + 1 && el.scrollWidth <= el.clientWidth + 1; });
  expect(fits).toBe(true);
  await page.getByRole('button', { name: '次の期間', exact: true }).click(); const next = new Date(date.getFullYear(), date.getMonth() + 2, 0); await expect(page.locator('.day-head')).toHaveCount(next.getDate());
  await page.setViewportSize({ width: 800, height: 900 });
  await page.locator('.gantt-shell').evaluate(el => el.scrollLeft = el.scrollWidth);
  const lastVisible = await page.locator('.gantt-shell').evaluate(el => { const r = el.getBoundingClientRect(), last = el.querySelector('.day-head:last-child')!.getBoundingClientRect(); return last.right <= r.right + 1 && last.left >= r.left; }); expect(lastVisible).toBe(true);
});

test('detail tabs keep drafts and persist Markdown, checklist, references and next action', async ({ page }) => {
  const data = emptyData(); data.outcomes.push(newOutcome('資料整理Outcome', 'o')); await writeFile(file, JSON.stringify(data));
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await go(page, 'Task・Outcome');
  await expect(page.locator('.topbar').getByRole('button', { name: '＋ Task' })).toHaveCount(0);
  await page.getByRole('button', { name: '資料整理OutcomeにTaskを追加', exact: true }).click();
  const editor = page.locator('dialog.drawer');
  await expect(editor.getByRole('tab')).toHaveText(['基本情報', 'メモ', '資料リンク0', '関連チャット0', '履歴']);
  await expect(editor.getByRole('button', { name: 'Outcome', exact: true })).toContainText('資料整理Outcome');
  await page.getByLabel('Task名', { exact: true }).fill('追加情報Task');
  await page.getByLabel('次の予定で行うこと').fill('議事録を整理する');
  await page.getByRole('button', { name: '＋ サブタスクを追加' }).click(); await page.getByLabel('サブタスク 1の名前').fill('資料を集める'); await page.getByLabel('サブタスク 1の完了').check();
  await page.getByRole('tab', { name: 'メモ', exact: true }).click();
  const memo = '# 検証メモ\n\n**太字**\n\n- [x] 完了\n\n| 項目 | 状態 |\n| --- | --- |\n| A | OK |\n\n```js\nconst a = 1;\n```\n\n<script>window.evil=true</script>\n\n[不正](javascript:alert(1))\n\n![外部画像](https://example.com/tracker.png)';
  const requests: string[] = []; page.on('request', request => { if (request.url().includes('example.com')) requests.push(request.url()); });
  await page.getByRole('textbox', { name: 'メモ', exact: true }).fill(memo); await page.getByRole('button', { name: 'プレビュー', exact: true }).click();
  await expect(editor.locator('.markdown-body h1')).toHaveText('検証メモ'); await expect(editor.locator('.markdown-body strong')).toHaveText('太字'); await expect(editor.locator('.markdown-body table')).toBeVisible(); await expect(editor.locator('.markdown-body pre')).toContainText('const a = 1');
  await expect(editor.locator('.markdown-body input')).toBeChecked(); await expect(editor.locator('.markdown-body script,.markdown-body img,.markdown-body a')).toHaveCount(0); expect(await page.evaluate(() => (window as Window & { evil?: boolean }).evil)).toBeUndefined(); expect(requests).toEqual([]);
  await page.getByRole('tab', { name: /^資料リンク/ }).click(); await page.getByRole('button', { name: '＋ 資料を追加' }).click();
  await editor.getByRole('textbox', { name: 'リンク先（URL／パス）', exact: true }).fill('C:\\Users\\User\\Documents\\資料 #1.xlsx'); await editor.getByRole('textbox', { name: '概要', exact: true }).fill('元データ');
  await expect(editor.getByRole('link', { name: '↗ ローカルのリンクを開く' })).toHaveAttribute('href', /file:\/\/\/C:.*%231/);
  await page.getByRole('tab', { name: /^関連チャット/ }).click(); await page.getByRole('button', { name: '＋ チャットを追加' }).click();
  await editor.getByRole('textbox', { name: 'リンク先（URL／パス）', exact: true }).fill('https://teams.microsoft.com/l/message/test'); await editor.getByRole('textbox', { name: '概要', exact: true }).fill('確認の会話');
  await page.getByRole('tab', { name: 'メモ', exact: true }).click(); await page.getByRole('button', { name: '編集', exact: true }).click(); await expect(page.getByRole('textbox', { name: 'メモ', exact: true })).toHaveValue(memo);
  await save(page); await page.reload(); await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '追加情報Task', exact: true }).click();
  await expect(page.getByLabel('次の予定で行うこと')).toHaveValue('議事録を整理する'); await expect(page.getByLabel('サブタスク 1の完了')).toBeChecked();
  await expect(page.getByRole('tab', { name: /^資料リンク/ })).toContainText('1'); await expect(page.getByRole('tab', { name: /^関連チャット/ })).toContainText('1');
  const saved = JSON.parse(await readFile(file, 'utf8')); expect(saved.tasks[0].memo).toBe(memo); expect(saved.tasks[0].status).toBe('Inbox'); expect(saved.tasks[0].outcomeId).toBe('o'); expect(saved.tasks[0].materials[0].summary).toBe('元データ'); expect(saved.tasks[0].chats[0].summary).toBe('確認の会話'); expect(errors).toEqual([]);
});

test('legacy task details, draft cancellation, invalid hidden fields, keyboard tabs and narrow width', async ({ page }) => {
  const legacy = newTask('旧Task', 'legacy'); delete legacy.materials; delete legacy.chats; delete legacy.subtasks; delete legacy.nextAction;
  await writeFile(file, JSON.stringify({ ...emptyData(), tasks: [legacy] }));
  await page.goto('/'); await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '旧Task', exact: true }).click();
  await page.getByRole('tab', { name: '基本情報', exact: true }).focus(); await page.keyboard.press('ArrowRight'); await expect(page.getByRole('tab', { name: 'メモ', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('textbox', { name: 'メモ', exact: true }).fill('破棄するメモ'); await page.getByRole('tab', { name: /^資料リンク/ }).click(); await page.getByRole('button', { name: '＋ 資料を追加' }).click();
  await page.getByRole('tab', { name: 'メモ', exact: true }).click(); await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByRole('tab', { name: /^資料リンク/ })).toHaveAttribute('aria-selected', 'true'); await expect(page.getByRole('alert')).toContainText('リンク先');
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click(); expect(JSON.parse(await readFile(file, 'utf8')).tasks[0]).toEqual(legacy);
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: '旧Task', exact: true }).click();
  const tabs = page.locator('.detail-tabs'); const metrics = await tabs.evaluate(el => ({ scroll: el.scrollWidth, width: el.clientWidth })); expect(metrics.scroll).toBeLessThanOrEqual(metrics.width + 1);
  await page.getByRole('tab', { name: /^関連チャット/ }).click(); await page.getByRole('button', { name: '＋ チャットを追加' }).click(); await page.getByRole('textbox', { name: 'リンク先（URL／パス）', exact: true }).fill('https://example.com/chat'); await page.getByRole('textbox', { name: '概要', exact: true }).fill('確認'); await save(page);
});

test('Task add rows on cards and Gantt preselect the parent without opening Outcome details', async ({ page }) => {
  const data = emptyData(); data.outcomes.push(newOutcome('追加先', 'o')); await writeFile(file, JSON.stringify(data));
  await page.goto('/'); await go(page, 'Task・Outcome'); await page.getByRole('tab', { name: 'Outcomeカード' }).click();
  await page.getByRole('button', { name: '追加先にTaskを追加', exact: true }).click(); await expect(page.getByLabel('Task名', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Outcome', exact: true })).toContainText('追加先'); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await go(page, 'ガントチャート'); await page.getByRole('button', { name: '追加先にTaskを追加', exact: true }).click(); await page.getByLabel('Task名', { exact: true }).fill('ガントからTask'); await save(page);
  expect(JSON.parse(await readFile(file, 'utf8')).tasks[0].outcomeId).toBe('o');
});

test('reference copying and deletion, checklist validation and schedule clearing persist together', async ({ page }) => {
  const task = { ...newTask('削除確認Task', 't'), next: `${localDate()}T09:00`, nextEnd: '10:00', nextAction: '予定の作業', subtasks: [{ id: 's', name: '確認', complete: false }], materials: [{ id: 'm', url: '/home/user/資料.txt', summary: '説明' }], chats: [{ id: 'c', url: 'https://example.com/chat', summary: '相談' }] };
  await writeFile(file, JSON.stringify({ ...emptyData(), tasks: [task] }));
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (value: string) => { (window as Window & { copied?: string }).copied = value; } }, configurable: true }); });
  await page.goto('/'); await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '削除確認Task', exact: true }).click();
  await page.getByRole('tab', { name: /^資料リンク/ }).click(); await page.getByRole('button', { name: 'リンク先をコピー', exact: true }).click();
  expect(await page.evaluate(() => (window as Window & { copied?: string }).copied)).toBe('/home/user/資料.txt');
  await expect(page.getByText('リンク先をコピーしました。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '資料リンク 1を削除', exact: true }).click();
  await page.getByRole('tab', { name: /^関連チャット/ }).click(); await page.getByRole('button', { name: '関連チャット 1を削除', exact: true }).click();
  await page.getByRole('tab', { name: '基本情報', exact: true }).click(); await page.getByRole('button', { name: '次の対応予定を解除', exact: true }).click(); await expect(page.getByLabel('次の予定で行うこと')).toHaveValue('');
  await page.getByRole('button', { name: 'サブタスク 1を削除', exact: true }).click(); await page.getByRole('button', { name: '＋ サブタスクを追加', exact: true }).click();
  await page.getByRole('tab', { name: 'メモ', exact: true }).click(); await page.getByRole('button', { name: '保存', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('サブタスク名'); await expect(page.getByRole('tab', { name: '基本情報', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'サブタスク 1を削除', exact: true }).click(); await save(page);
  const saved = JSON.parse(await readFile(file, 'utf8')).tasks[0]; expect(saved).toMatchObject({ materials: [], chats: [], subtasks: [], next: '', nextEnd: '', nextAction: '' });
});

test('approved layout keeps long titles bounded, periods aligned and weekday fields visible', async ({ page }) => {
  const day = localDate(), d = emptyData(), name = '長い件名の表示と省略を確認するためのタスク'.repeat(12);
  d.outcomes.push({ ...newOutcome('配置Outcome', 'o'), start: day, end: addDays(day, 3) });
  const legacy = { ...newTask(name, 't'), outcomeId: 'o', start: day, end: addDays(day, 3), due: day, next: `${day}T09:00`, nextEnd: '10:00' };
  delete legacy.materials; delete legacy.chats; delete legacy.subtasks; delete legacy.nextAction;
  d.tasks.push(legacy); await writeFile(file, JSON.stringify(d));
  await page.goto('/');
  for (const view of ['ダッシュボード', 'カレンダー', 'ガントチャート', 'Task・Outcome']) {
    await go(page, view); if (view === 'ダッシュボード') await expect(page.locator('.page-actions')).toHaveCount(0); else await expect(page.locator('.page-actions').getByRole('button')).toHaveText(['＋ Outcome', '＋ Task']);
  }
  const row = page.locator('.child-row'), title = row.locator('.row-title');
  await expect(title).toHaveAttribute('title', name);
  await expect(row.locator('td').nth(3)).toContainText(dateLabel(day));
  await expect(row.locator('td').nth(4)).toContainText(dateLabel(day));
  await expect(row.locator('td').nth(5)).toContainText(dateLabel(day));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.locator('.task-list-table').evaluate(el => {
      const parent = el.querySelector('.group-row td:nth-child(4)')!.getBoundingClientRect();
      const child = el.querySelector('.child-row td:nth-child(4)')!.getBoundingClientRect();
      const name = el.querySelector('.child-row .row-title')!, r = name.getBoundingClientRect(), status = el.querySelector('.child-row select')!.getBoundingClientRect();
      return { alignment: Math.abs(parent.left - child.left), gap: status.left - r.right, width: r.width, clamp: getComputedStyle(name).webkitLineClamp };
    });
    expect(geometry.alignment).toBeLessThan(1); expect(geometry.gap).toBeLessThanOrEqual(16); expect(geometry.width).toBeLessThanOrEqual(320); expect(geometry.clamp).toBe('2');
  }
  await title.click(); await expect(page.getByLabel('Task名', { exact: true })).toHaveValue(name);
  await expect(page.locator('.detail-tabs [role=tab]')).toHaveText(['基本情報', 'メモ', '資料リンク0', '関連チャット0', '履歴']);
});

test('completion checks restore status after reload and old Done records fall back to Inbox', async ({ page }) => {
  const d = emptyData(); d.tasks.push({ ...newTask('復元Task', 't'), status: 'Waiting' }, { ...newTask('旧Done', 'old'), status: 'Done' });
  await writeFile(file, JSON.stringify(d)); await page.goto('/'); await go(page, 'Task・Outcome');
  await page.getByLabel('復元Taskの完了', { exact: true }).check(); await expect(page.locator('.child-row')).toHaveCount(0);
  await page.reload(); await go(page, 'Task・Outcome'); await page.getByLabel('Doneも表示').check();
  await expect(page.getByLabel('復元Taskの完了', { exact: true })).toBeChecked();
  await page.getByLabel('復元Taskの完了', { exact: true }).uncheck(); await expect(page.locator('.child-row').filter({ hasText: '復元Task' }).getByLabel('復元Taskのステータス')).toHaveValue('Waiting');
  await page.getByLabel('旧Doneの完了', { exact: true }).uncheck(); await expect(page.locator('.child-row').filter({ hasText: '旧Done' }).getByLabel('旧Doneのステータス')).toHaveValue('Inbox');
});

test('completion controls save in every view and roll back a rejected write', async ({ page }) => {
  const d = emptyData(), day = localDate(); d.outcomes.push(newOutcome('完了位置Outcome', 'o'));
  d.tasks.push({ ...newTask('共通チェック', 't'), status: 'Doing', due: day, start: day, end: day, next: `${day}T09:00`, nextEnd: '10:00' });
  await writeFile(file, JSON.stringify(d)); await page.goto('/');
  for (const view of ['ダッシュボード', 'カレンダー', 'ガントチャート', 'Task・Outcome']) {
    await go(page, view);
    if (view === 'カレンダー' || view === 'Task・Outcome') await page.getByLabel('Doneも表示').check();
    if (view === 'Task・Outcome') await page.getByRole('tab', { name: 'Outcomeカード' }).click();
    await page.getByLabel('共通チェックの完了', { exact: true }).first().check();
    await expect.poll(async () => JSON.parse(await readFile(file, 'utf8')).tasks[0].status).toBe('Done');
    if (view === 'ダッシュボード') { await go(page, 'ガントチャート'); }
    await page.getByLabel('共通チェックの完了', { exact: true }).first().uncheck();
    await expect.poll(async () => JSON.parse(await readFile(file, 'utf8')).tasks[0].status).toBe('Doing');
  }
  await go(page, 'Task・Outcome'); await page.getByRole('tab', { name: '階層一覧' }).click();
  await page.route('**/api/tasks/t', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'テスト保存失敗' }) }));
  await page.getByLabel('共通チェックの完了', { exact: true }).check(); await expect(page.getByLabel('共通チェックの完了', { exact: true })).not.toBeChecked();
  expect(JSON.parse(await readFile(file, 'utf8')).tasks[0].status).toBe('Doing'); await page.unroute('**/api/tasks/t');
  await page.getByRole('button', { name: '完了位置Outcome', exact: true }).click();
  await expect(page.getByLabel('優先度', { exact: true })).toHaveCount(0);
  const heading = (await page.getByRole('heading', { name: '詳細を編集' }).boundingBox())!, complete = (await page.locator('.outcome-complete-control').boundingBox())!;
  expect(complete.x).toBeGreaterThan(heading.x + heading.width); expect(Math.abs(complete.y - heading.y)).toBeLessThan(15);
});

test('Outcome folding shares state, keeps parent details and adds Tasks at the end', async ({ page }) => {
  const day = localDate(), d = emptyData();
  d.outcomes.push({ ...newOutcome('開閉Outcome', 'o'), start: day, end: addDays(day, 3) }, newOutcome('空Outcome', 'empty'));
  d.tasks.push({ ...newTask('子Task', 't'), outcomeId: 'o', start: day, end: day }, newTask('未分類Task', 'u'));
  await writeFile(file, JSON.stringify(d)); const original = await readFile(file, 'utf8');
  await page.goto('/'); await go(page, 'Task・Outcome');
  await expect(page.locator('.group-row .task-add-action')).toHaveCount(0);
  const child = (await page.locator('.child-row').first().boundingBox())!, add = (await page.getByRole('button', { name: '開閉OutcomeにTaskを追加', exact: true }).boundingBox())!;
  expect(add.y).toBeGreaterThan(child.y + child.height);
  await expect(page.locator('.hierarchy-headings span')).toHaveText(['Outcome', 'Task']);
  await page.getByRole('button', { name: '開閉Outcomeを折りたたむ', exact: true }).click();
  await expect(page.locator('.child-row')).toHaveCount(1); await expect(page.getByRole('button', { name: '開閉OutcomeにTaskを追加', exact: true })).toHaveCount(0);
  await expect(page.locator('.group-period').first()).toContainText(dateLabel(day));
  await page.getByRole('button', { name: '開閉Outcome', exact: true }).click(); await expect(page.getByLabel('Outcome名', { exact: true })).toHaveValue('開閉Outcome'); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.getByRole('tab', { name: 'Outcomeカード' }).click(); await expect(page.locator('.outcome-card').first().locator('.task-row')).toHaveCount(0);
  await go(page, 'ガントチャート'); await expect(page.locator('.gantt-label.child')).toHaveCount(1); await expect(page.locator('.task-track')).toHaveCount(1);
  await page.getByRole('button', { name: '開閉Outcomeを展開する', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.gantt-label.child')).toHaveCount(2); await expect(page.locator('.task-track')).toHaveCount(2);
  const aligned = await page.locator('.gantt-shell').evaluate(el => {
    const labels = [...el.querySelectorAll('.gantt-label.child')].map(x => x.getBoundingClientRect().top);
    const tracks = [...el.querySelectorAll('.task-track')].map(x => x.getBoundingClientRect().top);
    return labels.every((top, i) => Math.abs(top - tracks[i]) < 1);
  }); expect(aligned).toBe(true);
  await page.getByRole('button', { name: 'Outcomeなしを折りたたむ', exact: true }).click(); await expect(page.locator('.gantt-label.child')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'OutcomeなしにTaskを追加', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '空Outcomeを折りたたむ', exact: true }).click(); await expect(page.getByRole('button', { name: '空OutcomeにTaskを追加', exact: true })).toHaveCount(0);
  expect(await readFile(file, 'utf8')).toBe(original);
  await page.getByRole('button', { name: '再読み込み', exact: true }).click(); await go(page, 'Task・Outcome'); await page.getByRole('tab', { name: '階層一覧', exact: true }).click(); await expect(page.locator('.child-row')).toHaveCount(2);
  await page.getByRole('button', { name: '空OutcomeにTaskを追加', exact: true }).click(); await expect(page.getByRole('button', { name: 'Outcome', exact: true })).toContainText('空Outcome'); await page.getByLabel('Task名', { exact: true }).fill('追加したTask'); await save(page);
  expect(JSON.parse(await readFile(file, 'utf8')).tasks.find((t: { name: string }) => t.name === '追加したTask').outcomeId).toBe('empty');
  await page.getByRole('button', { name: 'OutcomeなしにTaskを追加', exact: true }).click(); await expect(page.getByRole('button', { name: 'Outcome', exact: true })).toContainText('Outcomeを選択'); await page.getByLabel('Task名', { exact: true }).fill('未分類追加Task'); await save(page); expect(JSON.parse(await readFile(file, 'utf8')).tasks.find((t: { name: string }) => t.name === '未分類追加Task').outcomeId).toBe('');
});

test('default counts and existing dashboard and calendar dates survive the UI changes', async ({ page }) => {
  const day = localDate(), d = emptyData(); d.tasks.push({ ...newTask('0件Task', 't'), start: day, end: day, due: day, next: `${day}T09:00`, nextEnd: '10:00', nextAction: '確認する' });
  await writeFile(file, JSON.stringify(d)); await page.goto('/');
  await expect(page.locator('.page-head .eyebrow,.page-head .page-subtitle,.page-actions,.quick-add')).toHaveCount(0);
  await expect(page.locator('.grid-2 .panel').first()).toContainText(`${dateLabel(day)}09:00–10:00`);
  await expect(page.locator('.grid-2 .panel').last()).toContainText(`${dateLabel(day)} 〜 ${dateLabel(day)}`);
  await expect(page.locator('.task-detail-counts')).toHaveText(['資料 0 · チャット 0 · サブタスク 0/0', '資料 0 · チャット 0 · サブタスク 0/0']);
  await chooseDate(page, '予定の絞り込み開始日', addDays(day, 1)); await expect(page.locator('.grid-2 .panel').first().locator('.task-row')).toHaveCount(0); await page.getByRole('button', { name: '解除', exact: true }).click(); await expect(page.locator('.grid-2 .panel').first().locator('.task-row')).toHaveCount(1);
  await go(page, 'Task・Outcome'); await expect(page.locator('.child-row .task-detail-counts')).toHaveText(['資料 0 · チャット 0 · サブタスク 0/0']);
  await expect(page.getByLabel('Taskをすばやく追加')).toBeVisible(); await page.getByRole('tab', { name: 'Outcomeカード' }).click(); await expect(page.locator('.task-row .task-detail-counts')).toHaveText(['資料 0 · チャット 0 · サブタスク 0/0']);
  await go(page, 'ガントチャート'); await expect(page.locator('.gantt-label.child .task-detail-counts')).toHaveText(['資料 0 · チャット 0 · サブタスク 0/0']);
  await go(page, 'カレンダー'); await expect(page.locator('.schedule-day-track')).toHaveCount(7); await page.getByRole('button', { name: '月', exact: true }).click(); await expect(page.locator('.cal-day')).toHaveCount(42); await expect(page.locator('.cal-event.due')).toHaveCount(1); await expect(page.locator('.cal-event.next')).toHaveCount(1); await expect(page.locator('.calendar-task-copy .task-detail-counts')).toHaveCount(0);
  await page.getByRole('button', { name: '週', exact: true }).click(); await expect(page.locator('.schedule-day-track')).toHaveCount(7); await expect(page.locator('.schedule-event')).toHaveCount(1); await expect(page.locator('.schedule-day-head .task-detail-counts')).toHaveCount(0); await expect(page.locator('.schedule-event .task-detail-counts')).toHaveCount(0);
  await page.getByRole('button', { name: '日', exact: true }).click(); await expect(page.locator('.schedule-day-track')).toHaveCount(1); await expect(page.locator('.schedule-event')).toHaveCount(1); await page.getByRole('button', { name: '次の期間', exact: true }).click(); await expect(page.locator('.schedule-day-head strong')).toHaveText([dateLabel(addDays(day, 1))]);
  await page.getByRole('button', { name: '今日', exact: true }).click(); await expect(page.locator('.schedule-event')).toHaveCount(1);
  await expect(page.locator('.page-head .eyebrow,.page-head .page-subtitle')).toHaveCount(0);
});

test('timestamps and concise history persist without table columns or unchanged-save entries', async ({ page }) => {
  await page.goto('/'); await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '＋ Task', exact: true }).click();
  await expect(page.locator('.audit-meta')).toContainText('作成時に自動記録'); await page.getByLabel('Task名', { exact: true }).fill('履歴Task'); await save(page);
  let data = JSON.parse(await readFile(file, 'utf8')), task = data.tasks[0]; expect(task.history).toHaveLength(1); expect(task.createdAt).toBe(task.updatedAt);
  await page.getByRole('button', { name: '履歴Task', exact: true }).click(); await expect(page.locator('.audit-meta time')).toHaveCount(2);
  await page.getByRole('tab', { name: '履歴', exact: true }).click(); await expect(page.locator('.history-entry')).toHaveCount(1); await expect(page.locator('.history-entry')).toContainText('Taskを作成');
  await page.getByRole('tab', { name: '基本情報', exact: true }).click(); await page.getByLabel('ステータス', { exact: true }).selectOption('Doing');
  await page.getByRole('tab', { name: 'メモ', exact: true }).click(); await page.getByRole('textbox', { name: 'メモ', exact: true }).fill('長い本文'.repeat(100));
  await page.getByRole('tab', { name: '履歴', exact: true }).click(); await save(page);
  await page.getByRole('button', { name: '履歴Task', exact: true }).click(); await page.getByRole('tab', { name: '履歴', exact: true }).click();
  await expect(page.locator('.history-entry')).toHaveCount(2); await expect(page.locator('.history-entry').first()).toContainText('メモを変更、ステータス：Inbox → Doing'); await expect(page.locator('.history-list')).not.toContainText('長い本文');
  await save(page); data = JSON.parse(await readFile(file, 'utf8')); expect(data.tasks[0].history).toHaveLength(2); expect(data.tasks[0].createdAt).toBe(task.createdAt);
  await page.reload(); await go(page, 'Task・Outcome'); await expect(page.locator('thead')).not.toContainText('作成日'); await expect(page.locator('thead')).not.toContainText('更新日');
  await page.getByRole('button', { name: '履歴Task', exact: true }).click(); await page.getByRole('tab', { name: '基本情報', exact: true }).focus(); await page.keyboard.press('End'); await expect(page.getByRole('tab', { name: '履歴', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.history-entry')).toHaveCount(2); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.getByRole('button', { name: '＋ Outcome', exact: true }).click(); await page.getByLabel('Outcome名', { exact: true }).fill('履歴Outcome'); await save(page);
  await page.getByRole('button', { name: '履歴Outcome', exact: true }).click(); await expect(page.locator('dialog.drawer').getByRole('tab')).toHaveText(['基本情報', '履歴']); await page.getByRole('tab', { name: '履歴', exact: true }).click(); await expect(page.locator('.history-entry')).toContainText('Outcomeを作成');
  await page.getByRole('tab', { name: '基本情報', exact: true }).click(); await page.getByLabel('Outcome名', { exact: true }).fill('更新Outcome'); await page.getByRole('tab', { name: '履歴', exact: true }).click(); await save(page);
  await page.getByRole('button', { name: '更新Outcome', exact: true }).click(); await page.getByRole('tab', { name: '履歴', exact: true }).click(); await expect(page.locator('.history-entry').first()).toContainText('名前を変更');
});

test('local controls remain usable and legacy audit data is unknown and safely displayed', async ({ page }) => {
  const d = emptyData(); d.tasks.push(newTask('旧日時Task', 't')); d.outcomes.push(newOutcome('旧日時Outcome', 'o')); await writeFile(file, JSON.stringify(d));
  await page.goto('/'); await expect(page.locator('.topbar')).toHaveCount(0); await expect(page.locator('.app')).not.toContainText(/workspace/i);
  await expect(page.locator('.sidebar-bottom')).toContainText('LOCAL · JSON'); await page.getByLabel('時刻の選択間隔').selectOption('30'); await expect(page.getByRole('status')).toContainText('設定を保存');
  await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '旧日時Task', exact: true }).click(); await expect(page.locator('.audit-meta dd')).toHaveText(['不明', '不明']); await page.getByRole('tab', { name: '履歴', exact: true }).click(); await expect(page.locator('.history-empty')).toContainText('履歴はまだありません'); await save(page);
  expect(JSON.parse(await readFile(file, 'utf8')).tasks[0].history).toBeUndefined();
  await page.getByRole('button', { name: '旧日時Outcome', exact: true }).click(); await expect(page.locator('.audit-meta dd')).toHaveText(['不明', '不明']); await page.getByRole('tab', { name: '履歴', exact: true }).click(); await expect(page.locator('.history-empty')).toBeVisible(); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  const external = JSON.parse(await readFile(file, 'utf8')); external.tasks[0].history = [{ at: '2026-10-01T01:00:00Z', summary: '<img src=x onerror=window.evil=true>' }]; await writeFile(file, JSON.stringify(external));
  await page.setViewportSize({ width: 390, height: 844 }); await expect(page.locator('.mobile-local-controls').getByRole('button', { name: '再読み込み', exact: true })).toBeVisible(); await page.getByRole('button', { name: '再読み込み', exact: true }).click();
  await page.getByRole('button', { name: '旧日時Task', exact: true }).click(); await page.getByRole('tab', { name: '履歴', exact: true }).click(); await expect(page.locator('.history-entry')).toContainText('<img src=x'); await expect(page.locator('.history-list img')).toHaveCount(0); expect(await page.evaluate(() => (window as Window & { evil?: boolean }).evil)).toBeUndefined();
  const fits = await page.locator('.detail-tabs').evaluate(el => el.scrollWidth <= el.clientWidth + 1); expect(fits).toBe(true);
});


test('calendar clamps long names and exposes safe full text on hover and focus in every mode', async ({ page }) => {
  const day = localDate(), name = '関係部署のヒアリング結果を整理し、承認フローと担当者の引き継ぎ条件を確認する。'.repeat(8) + '<img src=x onerror=window.evil=true>';
  const d = emptyData(); d.tasks.push({ ...newTask(name, 'long-calendar'), due: day, next: day + 'T09:00', nextEnd: '10:00', materials: [{ id: 'm', url: 'https://example.com', summary: '資料' }] });
  await writeFile(file, JSON.stringify(d)); await page.goto('/'); await go(page, 'カレンダー');
  for (const mode of ['月', '週', '日']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await expect(page.locator('.calendar-task-copy .task-detail-counts')).toHaveCount(0);
    const button = page.locator(mode === '月' ? '.cal-event.next' : '.schedule-event-open').first();
    const compact = await button.evaluate(el => ({ height: el.getBoundingClientRect().height, clamp: getComputedStyle(el).webkitLineClamp, overflow: getComputedStyle(el).overflow }));
    expect(compact.height).toBeLessThanOrEqual(44); expect(compact.clamp).toBe('2'); expect(compact.overflow).toBe('hidden'); await expect(button).not.toHaveAttribute('title');
    await button.hover(); const tooltip = page.getByRole('tooltip'); await expect(tooltip).toBeVisible(); await expect(tooltip.locator('p')).toHaveText(name); await expect(tooltip).toContainText('09:00–10:00');
    await expect(tooltip.locator('img')).toHaveCount(0);
    await tooltip.hover(); await page.waitForTimeout(200); await expect(tooltip).toBeVisible();
    await page.keyboard.press('Escape'); await expect(tooltip).toHaveCount(0);
    await button.focus(); await expect(tooltip).toBeVisible();
    const bounds = (await tooltip.boundingBox())!; expect(bounds.x).toBeGreaterThanOrEqual(12); expect(bounds.x + bounds.width).toBeLessThanOrEqual(1428); expect(bounds.y + bounds.height).toBeLessThanOrEqual(988);
    await page.mouse.move(0, 0); await page.getByRole('button', { name: mode, exact: true }).focus(); await expect(tooltip).toHaveCount(0);
    await button.click(); await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByLabel('Task名', { exact: true })).toHaveValue(name); await expect(tooltip).toHaveCount(0); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  }
  expect(await page.evaluate(() => (window as Window & { evil?: boolean }).evil)).toBeUndefined();
});

test('calendar keeps short and overlapping schedules aligned and tooltip inside a narrow screen', async ({ page }) => {
  const day = localDate(), d = emptyData();
  d.tasks.push({ ...newTask('長い件名'.repeat(40), 'short'), next: day + 'T09:00', nextEnd: '09:15', due: day }, { ...newTask('次の予定', 'following'), next: day + 'T09:15', nextEnd: '09:45' }, { ...newTask('並行する予定', 'overlap'), next: day + 'T09:00', nextEnd: '09:30' });
  await writeFile(file, JSON.stringify(d)); await page.goto('/'); await go(page, 'カレンダー'); await page.getByRole('button', { name: '日', exact: true }).click();
  const geometry = await page.locator('.schedule-event').evaluateAll(elements => elements.map(el => ({ top: parseFloat((el as HTMLElement).style.top), height: parseFloat((el as HTMLElement).style.height), left: el.getBoundingClientRect().left, width: el.getBoundingClientRect().width, overflow: getComputedStyle(el).overflow })));
  expect(geometry[0].height).toBe(24); expect(geometry[2].top).toBe(geometry[0].top + 24); expect(geometry[1].left).toBeGreaterThan(geometry[0].left + geometry[0].width - 1); expect(geometry.every(x => x.overflow === 'hidden')).toBe(true);
  await expect(page.locator('.short-event .schedule-event-open')).toHaveCSS('-webkit-line-clamp', '1');
  await page.locator('.schedule-event-open').first().hover(); await expect(page.getByRole('tooltip')).toBeVisible(); await page.locator('.schedule-scroll').evaluate(el => el.scrollTop += 5); await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: '月', exact: true }).click();
  const button = page.locator('.cal-event.due').first(); await button.focus(); await expect(page.getByRole('tooltip')).toBeVisible();
  const rect = (await page.getByRole('tooltip').boundingBox())!; expect(rect.x).toBeGreaterThanOrEqual(12); expect(rect.x + rect.width).toBeLessThanOrEqual(378); expect(rect.y + rect.height).toBeLessThanOrEqual(832);
  await page.keyboard.press('Escape'); await expect(page.getByRole('tooltip')).toHaveCount(0);
  await button.click(); await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByRole('tooltip')).toHaveCount(0);
});

async function calendarTrack(page: Page, day: string) {
  const track = page.locator(`.schedule-day-track[data-calendar-day="${day}"]`);
  await track.evaluate(el => { const panel = el.closest('.schedule-scroll')!; panel.scrollTop = 720; panel.scrollLeft += el.getBoundingClientRect().left - panel.getBoundingClientRect().left - 100; });
  return track;
}
async function calendarDrag(page: Page, id: string, day: string, startHour: number, edge: 'start' | 'end' | 'move' = 'move', cancel = false) {
  const source = page.locator(`.schedule-event[data-calendar-task="${id}"]`);
  const box = (await source.boundingBox())!, track = page.locator(`.schedule-day-track[data-calendar-day="${day}"]`), bounds = (await track.boundingBox())!;
  const offset = edge === 'end' ? box.height - 2 : edge === 'start' ? 2 : box.height / 2;
  const grab = edge === 'end' ? -2 : offset;
  await page.mouse.move(box.x + box.width / 2, box.y + offset); await page.mouse.down();
  await page.mouse.move(bounds.x + Math.min(bounds.width / 2, 80), bounds.y + startHour * 96 + grab, { steps: 10 });
  await expect(page.locator('.calendar-drag-ghost')).toBeVisible(); await expect(page.locator('.add-preview')).toHaveCount(0);
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up(); await expect(page.locator('.calendar-drag-ghost')).toHaveCount(0); await page.waitForTimeout(400);
}
async function calendarUndo(page: Page) {
  await Promise.all([page.waitForResponse(response => response.url().includes('/api/tasks/') && response.request().method() === 'PUT'), page.getByRole('button', { name: '変更を元に戻す', exact: true }).click()]);
  await expect(page.getByLabel('追加・移動の時刻の刻み')).toBeEnabled();
  await expect(page.getByRole('button', { name: '変更を元に戻す', exact: true })).toBeDisabled();
  await expect(page.locator('.calendar-feedback')).toHaveCount(0);
}
async function calendarSaved(id: string) { return JSON.parse(await readFile(file, 'utf8')).tasks.find((task: { id: string }) => task.id === id); }

test('calendar adds only by double clicking blank space and opens details from coloured padding', async ({ page }) => {
  const day = localDate(), d = emptyData(); d.tasks.push({ ...newTask('枠の余白', 'hit'), next: day + 'T10:00', nextEnd: '11:00' });
  await writeFile(file, JSON.stringify(d)); await page.goto('/'); await go(page, 'カレンダー');
  for (const mode of ['日', '週']) {
    await page.getByRole('button', { name: mode, exact: true }).click(); const track = await calendarTrack(page, day), r = (await track.boundingBox())!;
    await expect(track).toHaveCSS('cursor', 'default');
    await expect(page.locator('.calendar-actions')).not.toContainText('空白をダブルクリックで追加');
    await page.mouse.move(r.x + 50, r.y + 13.25 * 96);
    await expect(page.locator('.add-preview')).toHaveText('＋ 13:15に追加（ダブルクリック）');
    expect(await page.locator('.add-preview').evaluate(el => parseFloat((el as HTMLElement).style.top))).toBe(13.25 * 96);
    await page.mouse.move(0, 0); await expect(page.locator('.add-preview')).toHaveCount(0);
    await page.mouse.click(r.x + 50, r.y + 13.25 * 96); await expect(page.locator('dialog.drawer')).toHaveCount(0);
    await page.mouse.dblclick(r.x + 50, r.y + 13.25 * 96); await expect(page.locator('dialog.drawer')).toBeVisible();
    await expect(page.getByRole('button', { name: '開始時刻', exact: true })).toHaveText('13:15'); await expect(page.getByRole('button', { name: '終了時刻', exact: true })).toHaveText('13:45');
    await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
    const box = (await page.locator('.schedule-event').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 2); await expect(page.locator('.add-preview')).toHaveCount(0);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 2); await expect(page.getByLabel('Task名', { exact: true })).toHaveValue('枠の余白');
    await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  }
  await page.getByLabel('追加・移動の時刻の刻み').selectOption('30'); await expect(page.getByLabel('時刻の選択間隔')).toHaveValue('30');
  const track = await calendarTrack(page, day), r = (await track.boundingBox())!; await page.mouse.move(r.x + 50, r.y + 13.2 * 96); await expect(page.locator('.add-preview')).toHaveText('＋ 13:00に追加（ダブルクリック）'); await page.mouse.dblclick(r.x + 50, r.y + 13.2 * 96);
  await expect(page.getByRole('button', { name: '開始時刻', exact: true })).toHaveText('13:00'); await page.getByLabel('Task名', { exact: true }).fill('空白から追加'); await save(page);
  expect((await calendarSaved(JSON.parse(await readFile(file, 'utf8')).tasks.find((t: { name: string }) => t.name === '空白から追加').id)).next).toBe(day + 'T13:00');
  await page.getByRole('button', { name: '月', exact: true }).click(); const blank = page.locator(`.cal-day[data-calendar-day="${addDays(day, 1)}"]`);
  await blank.click({ position: { x: 10, y: 10 } }); await expect(page.locator('dialog.drawer')).toHaveCount(0);
  await blank.dblclick({ position: { x: 10, y: 10 } }); await page.getByLabel('Task名', { exact: true }).fill('日付だけ');
  await expect(page.getByRole('button', { name: '次の対応予定（日付）', exact: true })).toContainText(dateLabel(addDays(day, 1)));
  await page.getByRole('button', { name: '作成', exact: true }).click(); await expect(page.locator('.form-error')).toContainText('すべて指定');
  await page.getByRole('button', { name: '開始時刻', exact: true }).click(); await page.getByRole('button', { name: '14:00', exact: true }).click();
  await page.getByRole('button', { name: '終了時刻', exact: true }).click(); await page.getByRole('button', { name: '14:30', exact: true }).click(); await save(page);
  expect(JSON.parse(await readFile(file, 'utf8')).tasks.find((t: { name: string }) => t.name === '日付だけ').next).toBe(addDays(day, 1) + 'T14:00');
});

test('calendar resizes edges and moves schedules with persisted history, undo and cancellation', async ({ page }) => {
  const day = localDate(), task = { ...newTask('予定を調整', 'drag'), next: day + 'T10:00', nextEnd: '11:00', due: day, start: day, end: addDays(day, 3), memo: '残すメモ', status: 'Doing' as const };
  const d = emptyData(); d.tasks.push(task); await writeFile(file, JSON.stringify(d)); await page.goto('/'); await go(page, 'カレンダー'); await page.getByRole('button', { name: '日', exact: true }).click(); await calendarTrack(page, day);
  await calendarDrag(page, 'drag', day, 11.5, 'end'); expect(await calendarSaved('drag')).toMatchObject({ ...task, nextEnd: '11:30' }); expect((await calendarSaved('drag')).history).toHaveLength(1); await expect(page.locator('.calendar-feedback,.toast')).toHaveCount(0);
  await page.locator('.schedule-event-open').click(); await expect(page.getByRole('button', { name: '開始時刻', exact: true })).toHaveText('10:00'); await expect(page.getByRole('button', { name: '終了時刻', exact: true })).toHaveText('11:30');
  await page.getByLabel('Task名', { exact: true }).fill('名前だけ変更'); await save(page);
  await calendarUndo(page); expect(await calendarSaved('drag')).toMatchObject({ name: '名前だけ変更', next: day + 'T10:00', nextEnd: '11:00' });
  await calendarDrag(page, 'drag', day, 9.5, 'start'); expect(await calendarSaved('drag')).toMatchObject({ next: day + 'T09:30', nextEnd: '11:00' });
  await calendarDrag(page, 'drag', day, 12, 'end', true); expect((await calendarSaved('drag')).nextEnd).toBe('11:00'); await expect(page.locator('dialog.drawer')).toHaveCount(0);
  await calendarUndo(page);
  await page.getByLabel('追加・移動の時刻の刻み').selectOption('30'); await calendarDrag(page, 'drag', day, 9, 'end'); expect((await calendarSaved('drag')).nextEnd).toBe('10:30');
  await calendarUndo(page);
  await page.getByRole('button', { name: '週', exact: true }).click();
  const weekEnd = addDays(day, 6 - new Date(day + 'T12:00').getDay()), target = day === weekEnd ? addDays(day, -1) : addDays(day, 1);
  await calendarTrack(page, day); await calendarDrag(page, 'drag', target, 11); expect(await calendarSaved('drag')).toMatchObject({ next: target + 'T11:00', nextEnd: '12:00', due: day, start: day, end: task.end, memo: task.memo });
  await page.reload(); await go(page, 'カレンダー'); expect((await calendarSaved('drag')).next).toBe(target + 'T11:00');
  await page.getByRole('button', { name: '月', exact: true }).click();
  const monthSource = page.locator('[data-calendar-task="drag"][data-calendar-kind="next"]'), a = (await monthSource.boundingBox())!, b = (await page.locator(`.cal-day[data-calendar-day="${day}"]`).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + b.height - 10, { steps: 10 }); await page.mouse.up();
  await expect.poll(async () => (await calendarSaved('drag')).next).toBe(day + 'T11:00'); expect((await calendarSaved('drag')).nextEnd).toBe('12:00');
  await expect(page.locator('dialog.drawer')).toHaveCount(0);
});

test('calendar moves deadlines only in week headers and month dates, with undo and invalid-drop cancellation', async ({ page }) => {
  const day = localDate(), d = emptyData(), task = { ...newTask('締切を調整', 'due'), due: day, next: day + 'T10:00', nextEnd: '11:00', start: day, end: addDays(day, 2) }; d.tasks.push(task);
  await writeFile(file, JSON.stringify(d)); await page.goto('/'); await go(page, 'カレンダー'); await page.getByRole('button', { name: '週', exact: true }).click();
  const target = addDays(day, new Date(day + 'T12:00').getDay() === 6 ? -1 : 1);
  async function deadlineDrop(selector: string, cancel = false) {
    const source = page.locator('[data-calendar-task="due"][data-calendar-kind="due"]'), a = (await source.boundingBox())!, b = (await page.locator(selector).boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + Math.min(b.height / 2, 140), { steps: 10 });
    await expect(page.locator('.calendar-drag-ghost')).toBeVisible(); if (cancel) await page.keyboard.press('Escape'); await page.mouse.up(); await page.waitForTimeout(400);
  }
  await calendarTrack(page, day); await deadlineDrop(`[data-calendar-due-day="${target}"]`); expect(await calendarSaved('due')).toMatchObject({ ...task, due: target });
  await calendarUndo(page); expect((await calendarSaved('due')).due).toBe(day);
  await deadlineDrop(`[data-calendar-due-day="${target}"]`, true); expect((await calendarSaved('due')).due).toBe(day);
  await deadlineDrop(`.schedule-day-track[data-calendar-day="${target}"]`); expect((await calendarSaved('due')).due).toBe(day); await expect(page.locator('dialog.drawer')).toHaveCount(0);
  await page.getByRole('button', { name: '月', exact: true }).click(); await deadlineDrop(`.cal-day[data-calendar-day="${target}"]`); expect(await calendarSaved('due')).toMatchObject({ ...task, due: target });
  await calendarUndo(page); expect((await calendarSaved('due')).due).toBe(day);
  await page.getByRole('button', { name: '日', exact: true }).click(); await page.locator('.schedule-due').click(); await expect(page.getByLabel('Task名', { exact: true })).toHaveValue(task.name);
});

test('calendar keeps original schedule when saving a drag fails', async ({ page }) => {
  const day = localDate(), d = emptyData(); d.tasks.push({ ...newTask('保存失敗', 'reject-drag'), next: day + 'T10:00', nextEnd: '11:00' }); await writeFile(file, JSON.stringify(d));
  await page.goto('/'); await go(page, 'カレンダー'); await page.getByRole('button', { name: '日', exact: true }).click(); await calendarTrack(page, day);
  await page.route('**/api/tasks/reject-drag', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: '保存拒否' }) }));
  await calendarDrag(page, 'reject-drag', day, 11.5, 'end'); await expect(page.locator('.calendar-feedback')).toContainText('保存できません');
  await expect(page.locator('.schedule-event-open')).toContainText('10:00–11:00'); expect((await calendarSaved('reject-drag')).nextEnd).toBe('11:00'); await expect(page.getByRole('button', { name: '変更を元に戻す', exact: true })).toBeDisabled();
});

test('calendar addition hint stays before the following task and matches the new task times', async ({ page }) => {
  const day = localDate(), d = emptyData(); d.settings.timeStep = 30;
  d.tasks.push({ ...newTask('12時の既存予定', 'noon'), next: day + 'T12:00', nextEnd: '13:00' });
  await writeFile(file, JSON.stringify(d)); await page.goto('/'); await go(page, 'カレンダー');
  for (const mode of ['日', '週']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    for (const step of ['30', '15']) {
      await page.getByLabel('追加・移動の時刻の刻み').selectOption(step); await expect(page.getByLabel('追加・移動の時刻の刻み')).toBeEnabled();
      const track = await calendarTrack(page, day), r = (await track.boundingBox())!;
      await page.mouse.move(r.x + 50, r.y + (12 - 1 / 60) * 96);
      const hint = page.locator('.add-preview'), expected = step === '30' ? '11:30' : '11:45';
      await expect(hint).toHaveText(`＋ ${expected}に追加（ダブルクリック）`);
      const hintBox = (await hint.boundingBox())!, taskBox = (await page.locator('.schedule-event[data-calendar-task="noon"]').boundingBox())!;
      expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(taskBox.y + 0.5);
      await page.mouse.dblclick(r.x + 50, r.y + (12 - 1 / 60) * 96);
      await expect(page.getByRole('button', { name: '開始時刻', exact: true })).toHaveText(expected);
      await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
    }
    await page.getByLabel('追加・移動の時刻の刻み').selectOption('30'); await expect(page.getByLabel('追加・移動の時刻の刻み')).toBeEnabled();
    const track = await calendarTrack(page, day), r = (await track.boundingBox())!;
    await page.mouse.dblclick(r.x + 50, r.y + (12 - 1 / 60) * 96);
    await expect(page.getByRole('button', { name: '開始時刻', exact: true })).toHaveText('11:30');
    await expect(page.getByRole('button', { name: '終了時刻', exact: true })).toHaveText('12:00');
    await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
    const existing = (await page.locator('.schedule-event').boundingBox())!;
    await page.mouse.move(existing.x + existing.width / 2, existing.y + 20); await expect(page.locator('.add-preview')).toHaveCount(0);
    await page.mouse.click(existing.x + existing.width / 2, existing.y + 20); await expect(page.getByLabel('Task名', { exact: true })).toHaveValue('12時の既存予定');
    await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  }
  expect(JSON.parse(await readFile(file, 'utf8')).tasks).toEqual(d.tasks);
});

test('calendar defaults to week at eight and keeps scroll position through saves and undo', async ({ page }) => {
  const day = localDate(), d = emptyData(); d.tasks.push({ ...newTask('初期時刻確認', 'eight'), next: day + 'T10:00', nextEnd: '11:00' });
  await writeFile(file, JSON.stringify(d)); await page.goto('/'); await go(page, 'カレンダー');
  await expect(page.getByRole('button', { name: '週', exact: true })).toHaveClass(/active/); await expect(page.locator('.schedule-day-track')).toHaveCount(7);
  async function atEight() {
    const scroll = page.locator('.schedule-scroll');
    await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(756);
    const hour = (await page.locator('.schedule-hour').filter({ hasText: /^8:00$/ }).boundingBox())!, header = (await page.locator('.schedule-corner').boundingBox())!;
    expect(hour.y).toBeGreaterThanOrEqual(header.y + header.height); expect(hour.y).toBeLessThan(header.y + header.height + 20);
  }
  await atEight(); await page.locator('.schedule-scroll').evaluate(el => el.scrollTop = 0);
  expect(await page.locator('.schedule-scroll').evaluate(el => el.scrollTop)).toBe(0); await expect(page.locator('.schedule-hour').filter({ hasText: /^0:00$/ })).toHaveCount(1);
  await page.getByRole('button', { name: '日', exact: true }).click(); await atEight();
  await calendarTrack(page, day); await calendarDrag(page, 'eight', day, 11.5, 'end');
  expect(await page.locator('.schedule-scroll').evaluate(el => el.scrollTop)).toBe(720);
  await page.locator('.schedule-event-open').click(); await page.getByLabel('Task名', { exact: true }).fill('編集後も位置を維持'); await save(page);
  expect(await page.locator('.schedule-scroll').evaluate(el => el.scrollTop)).toBe(720);
  await calendarUndo(page); expect(await page.locator('.schedule-scroll').evaluate(el => el.scrollTop)).toBe(720);
  await page.getByRole('button', { name: '週', exact: true }).click(); await atEight();
  await page.locator('.schedule-scroll').evaluate(el => el.scrollTop = 1000); await page.getByRole('button', { name: '月', exact: true }).click();
  await expect(page.locator('.cal-day')).toHaveCount(42); await page.getByRole('button', { name: '日', exact: true }).click(); await atEight();
  await page.getByRole('button', { name: '月', exact: true }).click(); await page.getByRole('button', { name: '週', exact: true }).click(); await atEight();
  await go(page, 'Task・Outcome'); await go(page, 'カレンダー'); await expect(page.getByRole('button', { name: '週', exact: true })).toHaveClass(/active/); await atEight();
});
