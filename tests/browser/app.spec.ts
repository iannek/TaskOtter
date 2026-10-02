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
  await page.goto('/'); await page.getByLabel('Taskをすばやく追加').fill('最初のTask'); await page.getByRole('button', { name: '追加', exact: true }).click();
  await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '最初のTask', exact: true }).click();
  await page.getByRole('button', { name: 'カテゴリ', exact: true }).click(); await page.getByRole('button', { name: '＋ 新しいカテゴリを作成', exact: true }).click(); await page.getByLabel('新しいカテゴリ名').fill('自由カテゴリ'); await page.getByRole('button', { name: 'このカテゴリを使う', exact: true }).click(); await page.getByLabel('ステータス', { exact: true }).selectOption('Doing'); await page.getByLabel('メモ', { exact: true }).fill('<script>window.evil=true</script>'); await save(page);
  await page.reload(); await go(page, 'Task・Outcome'); await expect(page.getByRole('cell', { name: '自由カテゴリ', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '最初のTask', exact: true }).click(); await expect(page.getByLabel('メモ', { exact: true })).toHaveValue('<script>window.evil=true</script>');
  page.on('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: '削除', exact: true }).click(); await expect(page.locator('dialog')).toHaveCount(0); expect(JSON.parse(await readFile(file, 'utf8')).tasks).toHaveLength(0); expect(errors).toEqual([]);
});
test('create Outcome and scheduled Task, popups, warnings and all calendar modes', async ({ page }) => {
  const day = localDate(); await page.goto('/'); await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '＋ Outcome', exact: true }).click();
  await page.getByLabel('Outcome名', { exact: true }).fill('成果'); await chooseDate(page, '期間開始日', day); await chooseDate(page, '期間終了日', addDays(day, 3)); await save(page);
  await page.getByRole('button', { name: '＋ Taskを追加' }).click(); await page.getByLabel('Task名', { exact: true }).fill('予定Task'); await page.getByRole('button', { name: 'Outcome', exact: true }).click(); await page.getByRole('button', { name: '成果 · 進行中', exact: true }).click();
  await chooseDate(page, '期間開始日', addDays(day, -1)); await expect(page.getByText('⚠ Outcomeの期間からはみ出しています。保存は可能です。')).toBeVisible();
  await chooseDate(page, '締切日', day); await chooseDate(page, '次の対応予定（日付）', day);
  await page.getByRole('button', { name: '開始時刻', exact: true }).click(); await page.getByRole('button', { name: '09:15', exact: true }).click();
  await page.getByRole('button', { name: '終了時刻', exact: true }).click(); await page.getByRole('button', { name: '10:30', exact: true }).click(); await save(page);
  await page.screenshot({ path: 'test-results/taskotter-editor-result.png', fullPage: true });
  await go(page, 'ガントチャート'); await expect(page.locator('.bar.warn')).toHaveCount(1);
  await go(page, 'カレンダー'); await expect(page.locator('.cal-event')).toHaveCount(2); await page.getByRole('button', { name: '週', exact: true }).click(); await expect(page.locator('.schedule-day-track')).toHaveCount(7); await expect(page.locator('.schedule-event')).toHaveCount(1);
  await page.getByRole('button', { name: '日', exact: true }).click(); await expect(page.locator('.schedule-day-track')).toHaveCount(1);
  await page.getByLabel('時刻の選択間隔').selectOption('30'); await expect(page.getByRole('status')).toContainText('設定を保存'); expect(JSON.parse(await readFile(file, 'utf8')).settings.timeStep).toBe(30);
});
test('Outcome completion and automatic clear when Task is reopened', async ({ page }) => {
  const d = emptyData(); d.outcomes.push(newOutcome('成果', 'o')); d.tasks.push({ ...newTask('Task', 't'), outcomeId: 'o' }); await writeFile(file, JSON.stringify(d));
  await page.goto('/'); await go(page, 'Task・Outcome'); await page.getByLabel('Doneも表示').check(); await page.getByRole('button', { name: '成果', exact: true }).click(); await expect(page.getByLabel('完了フラグ')).toBeDisabled(); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.getByRole('button', { name: 'Task', exact: true }).click(); await page.getByLabel('ステータス', { exact: true }).selectOption('Done'); await save(page);
  await page.getByRole('button', { name: '成果', exact: true }).click(); await page.getByLabel('完了フラグ').check(); await save(page);
  await page.getByRole('button', { name: 'Task', exact: true }).click(); await page.getByLabel('ステータス', { exact: true }).selectOption('Inbox'); await save(page); expect(JSON.parse(await readFile(file, 'utf8')).outcomes[0].complete).toBe(false);
});
test('external malformed data locks editing without changing file, and repair restores it', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '＋ Taskを追加' }).click(); await page.getByLabel('Task名', { exact: true }).fill('保存できない');
  await writeFile(file, '{"invalid":'); await page.getByRole('button', { name: '作成', exact: true }).click(); await expect(page.getByRole('button', { name: '作成', exact: true })).toBeDisabled(); expect(await readFile(file, 'utf8')).toBe('{"invalid":');
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('JSON構文エラー'); await expect(page.getByRole('button', { name: '＋ Taskを追加' })).toBeDisabled();
  const repaired = emptyData(); repaired.tasks.push(newTask('AIから追加', 'external')); await writeFile(file, JSON.stringify(repaired)); await page.getByRole('button', { name: '再読み込み' }).click(); await expect(page.getByRole('button', { name: '＋ Taskを追加' })).toBeEnabled(); await go(page, 'Task・Outcome'); await expect(page.getByRole('button', { name: 'AIから追加', exact: true })).toBeVisible();
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
  await go(page, 'Task・Outcome'); await page.getByRole('tab', { name: 'Outcomeカード' }).click(); await expect(page.locator('.outcome-card')).toHaveCount(3); await expect(page.locator('.outcome-card').last()).toContainText('最古の予定'); await page.getByRole('tab', { name: '階層一覧' }).click();
  await page.getByLabel('Taskのカテゴリ').selectOption('カテゴリA'); await expect(page.locator('.child-row')).toHaveCount(1); await page.getByLabel('Task名を検索').fill('該当なし'); await expect(page.locator('.child-row')).toHaveCount(0);
  await go(page, 'ガントチャート'); await page.getByLabel('ガントのステータス').selectOption('Waiting'); await expect(page.locator('.gantt-label.parent')).toHaveCount(2); await expect(page.locator('.gantt-label.parent')).toContainText(['空の未完了Outcome', '親Outcome']);
  await go(page, 'カレンダー'); await expect(page.locator('.cal-event.due')).toHaveCount(0); await page.getByLabel('Doneも表示').check(); await expect(page.locator('.cal-event.due')).toHaveCount(1); await page.getByRole('button', { name: '日', exact: true }).click(); await expect(page.locator('.schedule-event')).toHaveCount(2);
  const positions = await page.locator('.schedule-event').evaluateAll(elements => elements.map(el => ({ left: el.getBoundingClientRect().left, width: el.getBoundingClientRect().width })));
  expect(positions[0].left).not.toBe(positions[1].left); expect(positions.every(p => p.width > 70)).toBe(true);
});
test('editor closes outside, resizes by dragging, and preserves its width while opening other records', async ({ page }) => {
  const d = emptyData(); d.tasks.push(newTask('調整するTask', 't')); await writeFile(file, JSON.stringify(d));
  await page.goto('/'); await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '調整するTask', exact: true }).click();
  const editor = page.locator('dialog.drawer'); await page.getByLabel('メモ', { exact: true }).fill('未保存のメモ'); await expect(editor).toBeVisible();
  const original = (await editor.boundingBox())!, handle = await page.getByRole('separator', { name: 'サイドバーの幅' }).boundingBox();
  await page.mouse.move(handle!.x + 4, 400); await page.mouse.down(); await page.mouse.move(handle!.x - 160, 400, { steps: 10 }); await page.mouse.up();
  const resized = (await editor.boundingBox())!; expect(resized.width).toBeGreaterThan(original.width + 150); await expect(page.getByLabel('メモ', { exact: true })).toHaveValue('未保存のメモ');
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
  await go(page, 'ガントチャート'); const dates = await page.locator('.day-head strong').allTextContents(); expect(dates).toHaveLength(14); expect(dates).toContain(dateLabel(day)); expect(dates.every(text => /^\d{1,2}\/\d{1,2}\([日月火水木金土]\)$/.test(text))).toBe(true);
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
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: '＋ Taskを追加', exact: true }).click();
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
  await page.getByRole('button', { name: '既存Outcome · 進行中 · Medium · existing', exact: true }).click(); await save(page);
  expect(JSON.parse(await readFile(file, 'utf8')).tasks[0].outcomeId).toBe('existing');
  await page.getByRole('button', { name: 'Outcome確認Task', exact: true }).click(); await page.getByRole('button', { name: 'Outcome', exact: true }).click(); await page.getByRole('button', { name: '完了Outcome · 完了', exact: true }).click();
  await expect(page.getByText('このタスクを保存すると、選択したOutcomeの完了が解除されます。')).toBeVisible(); await save(page);
  expect(JSON.parse(await readFile(file, 'utf8')).outcomes[0].complete).toBe(false);
  await page.getByRole('button', { name: 'Outcome確認Task', exact: true }).click(); await page.getByRole('button', { name: 'Outcome', exact: true }).click(); await page.getByRole('button', { name: '＋ 新しいOutcomeを作成', exact: true }).click();
  await page.getByLabel('新しいOutcome名').fill('新しい成果'); await page.getByRole('button', { name: 'このOutcomeを使う', exact: true }).click(); await save(page);
  let saved = JSON.parse(await readFile(file, 'utf8')); expect(saved.outcomes).toHaveLength(3); expect(saved.tasks[0].outcomeId).toBe(saved.outcomes[2].id);
  await page.getByRole('button', { name: '＋ Taskを追加', exact: true }).click(); await page.getByLabel('Task名', { exact: true }).fill('同時作成Task');
  await page.getByRole('button', { name: 'Outcome', exact: true }).click(); await page.getByRole('button', { name: '＋ 新しいOutcomeを作成', exact: true }).click(); await page.getByLabel('新しいOutcome名').fill('同時作成Outcome'); await page.getByRole('button', { name: 'このOutcomeを使う', exact: true }).click(); await save(page);
  saved = JSON.parse(await readFile(file, 'utf8')); expect(saved.tasks).toHaveLength(2); expect(saved.tasks[1].outcomeId).toBe(saved.outcomes[3].id);
  await page.reload(); await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '同時作成Task', exact: true }).click(); await expect(page.getByRole('button', { name: 'Outcome', exact: true })).toContainText('同時作成Outcome');
});
test('new standalone Outcome excludes unassigned Tasks and cards open from their background', async ({ page }) => {
  const d = emptyData(); d.tasks.push(newTask('未分類Task', 't')); await writeFile(file, JSON.stringify(d));
  await page.goto('/'); await go(page, 'Task・Outcome'); await page.getByRole('button', { name: '＋ Outcome', exact: true }).click();
  await expect(page.locator('.summary-box')).toContainText('紐づくTask 0件'); await expect(page.getByLabel('完了フラグ')).toBeEnabled();
  await page.getByLabel('Outcome名', { exact: true }).fill('独立Outcome'); await save(page);
  let saved = JSON.parse(await readFile(file, 'utf8')); expect(saved.tasks[0].outcomeId).toBe('');
  const colors = await page.locator('.table').evaluate(el => [getComputedStyle(el.querySelector('.group-row td')!).backgroundColor, getComputedStyle(el.querySelector('.child-row td')!).backgroundColor]); expect(colors[0]).not.toBe(colors[1]);
  await page.getByRole('tab', { name: 'Outcomeカード' }).click(); await expect(page.locator('.outcome-card')).toContainText('紐づくTaskなし');
  await page.locator('.outcome-card .outcome-meta').click(); await expect(page.getByLabel('Outcome名', { exact: true })).toHaveValue('独立Outcome'); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.locator('.outcome-card').focus(); await page.keyboard.press('Enter'); await expect(page.getByLabel('Outcome名', { exact: true })).toHaveValue('独立Outcome'); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
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
  await expect(page.locator('.day-head strong')).toHaveText(['2/28(月)', '2/29(火)', '3/1(水)']);
  await page.getByRole('button', { name: '次の期間', exact: true }).click(); await expect(page.locator('.day-head strong')).toHaveText(['3/2(木)', '3/3(金)', '3/4(土)']);
  await chooseDate(page, 'ガントの表示終了日', '2028-03-01'); await page.getByRole('button', { name: '期間を適用', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('表示開始日以降'); await expect(page.locator('.day-head')).toHaveCount(3);
  await chooseDate(page, 'ガントの表示開始日', '2028-03-01'); await page.getByRole('button', { name: '期間を適用', exact: true }).click(); await expect(page.locator('.day-head')).toHaveCount(1);
  await page.getByRole('button', { name: '今日', exact: true }).click(); await expect(page.locator('.day-head strong')).toHaveText([dateLabel(day)]);
});
test('Outcome rows open from empty space and Done Tasks are hidden until requested', async ({ page }) => {
  const d = emptyData(); d.outcomes.push(newOutcome('行全体Outcome', 'o')); d.tasks.push({ ...newTask('未完了のTask', 't'), outcomeId: 'o' }, { ...newTask('完了したTask', 'done'), status: 'Done', outcomeId: 'o' }); await writeFile(file, JSON.stringify(d));
  await page.goto('/'); await go(page, 'Task・Outcome'); await expect(page.locator('.child-row')).toHaveCount(1); await expect(page.getByRole('button', { name: '完了したTask', exact: true })).toHaveCount(0);
  await page.locator('.group-meta').first().click(); await expect(page.getByLabel('Outcome名', { exact: true })).toHaveValue('行全体Outcome'); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.locator('.group-row.clickable').first().focus(); await page.keyboard.press('Enter'); await expect(page.getByLabel('Outcome名', { exact: true })).toHaveValue('行全体Outcome'); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.getByLabel('Doneも表示').check(); await expect(page.locator('.child-row')).toHaveCount(2); await page.getByLabel('Doneも表示').uncheck(); await page.getByLabel('Taskのステータス', { exact: true }).selectOption('Done'); await expect(page.locator('.child-row')).toHaveCount(1); await expect(page.getByRole('button', { name: '完了したTask', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Outcomeカード' }).click(); await expect(page.locator('.outcome-card').getByRole('button', { name: '完了したTask', exact: true })).toHaveCount(0); await expect(page.locator('.outcome-footer')).toContainText('Task 1 / 2 Done');
  await page.getByLabel('Doneも表示').check(); await expect(page.locator('.outcome-card').getByRole('button', { name: '完了したTask', exact: true })).toBeVisible();
  await go(page, 'ガントチャート'); await page.locator('.outcome-label .selection-info').click(); await expect(page.getByLabel('Outcome名', { exact: true })).toHaveValue('行全体Outcome'); await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
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
