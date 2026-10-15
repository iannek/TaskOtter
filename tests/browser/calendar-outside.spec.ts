import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { emptyData, newTask, localDate, addDays, type Task } from '../../src/shared/model.js';
let file: string;
const day = localDate(), weekStart = addDays(day, -new Date(day + 'T12:00').getDay()), past = addDays(weekStart, -4), future = addDays(weekStart, 10);
const saved = async (id: string): Promise<Task> => JSON.parse(await readFile(file, 'utf8')).tasks.find((t: Task) => t.id === id);
async function settle(page: Page) { await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); }
async function drag(page: Page, id: string, selector: string, hour?: number, cancel = false) {
  await settle(page);
  const source = page.locator(`[data-outside-task="${id}"]`); await source.scrollIntoViewIfNeeded();
  const target = page.locator(selector), panel = page.locator('.schedule-scroll');
  if (await panel.count()) { const x = (await target.boundingBox())!.x; await panel.evaluate((el, left) => el.scrollLeft += left - el.getBoundingClientRect().left - 100, x); }
  const a = (await source.boundingBox())!, b = (await target.boundingBox())!;
  const pixels = hour === undefined ? 0 : await panel.evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--hour-pixels')));
  await page.mouse.move(a.x + Math.min(80, a.width / 2), a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + Math.min(80, b.width / 2), hour === undefined ? b.y + 24 : b.y + hour * pixels + 1);
  await expect(page.locator('.calendar-drag-ghost')).toBeVisible();
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up(); await expect(page.locator('.calendar-drag-ghost')).toHaveCount(0); await page.waitForTimeout(400);
}
test.beforeEach(async ({ page }) => {
  file = join(await readFile('test-results/data-directory.txt', 'utf8'), 'taskotter.json');
  const d = emptyData(); d.tasks = [
    { ...newTask('表示中の予定', 'inside'), next: day + 'T10:00', nextEnd: '11:00', due: day },
    { ...newTask('過去の予定', 'past'), next: past + 'T10:00', nextEnd: '11:30', due: future, memo: '保持するメモ', start: day, end: addDays(day, 2) },
    { ...newTask('来週の予定', 'future'), next: future + 'T15:00', nextEnd: '16:00', due: day },
    { ...newTask('メール確認', 'undated'), quick: true },
    { ...newTask('長い件名'.repeat(40), 'long'), next: future + 'T13:00', nextEnd: '13:30', category: 'とても長いカテゴリ名'.repeat(5) },
    { ...newTask('完了した過去予定', 'done'), status: 'Done', next: past + 'T08:00', nextEnd: '09:00' },
  ]; await writeFile(file, JSON.stringify(d)); await page.goto('/'); await page.locator('.sidebar').getByRole('button', { name: 'カレンダー', exact: true }).click(); await settle(page);
});
test('right tray groups dates, shares Done filtering, switches date criteria and preserves responsive geometry', async ({ page }) => {
  const tray = page.getByRole('complementary', { name: '表示範囲外のTask' });
  await expect(tray.locator('.outside-task')).toHaveCount(4); await expect(tray).toContainText('日付なし'); await expect(tray.locator('[data-outside-task="inside"]')).toHaveCount(0);
  const panel = (await page.locator('.schedule-scroll').boundingBox())!, bounds = (await tray.boundingBox())!; expect(bounds.x).toBeGreaterThan(panel.x + panel.width); expect(bounds.height).toBeCloseTo(panel.height, 0);
  await tray.locator('.outside-date-heading').first().click(); await expect(tray.locator('[data-outside-task="past"]')).toHaveCount(0); await tray.locator('.outside-date-heading').first().click();
  await page.getByLabel('Doneも表示').check(); await expect(tray.locator('[data-outside-task="done"]')).toBeVisible(); await page.getByLabel('Doneも表示').uncheck();
  await tray.getByRole('button', { name: '締切日', exact: true }).click(); await expect(tray.locator('[data-outside-task="future"]')).toHaveCount(0); await expect(tray.locator('[data-outside-task="past"]')).toBeVisible();
  await tray.getByRole('button', { name: '対応予定日', exact: true }).click();
  const long = tray.locator('[data-outside-task="long"] .outside-task-title'); await expect(long).toHaveCSS('-webkit-line-clamp', '2'); expect((await long.boundingBox())!.height).toBeLessThan(50); expect((await tray.locator('[data-outside-task="long"] .outside-task-category').boundingBox())!.height).toBeLessThan(24);
  for (const width of [1440, 1024, 390]) { await page.setViewportSize({ width, height: 1000 }); await settle(page); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); const visible = await tray.evaluate(el => { const r = el.getBoundingClientRect(); return r.width > 250 && r.right <= innerWidth; }); expect(visible).toBe(true); await page.screenshot({path: `test-results/calendar-outside-${width}.png`, fullPage: true}); }
});
test('schedule drops preserve duration and other fields, undo and Escape, and persist across reloads', async ({ page }) => {
  const before = await saved('past'); await drag(page, 'past', `.schedule-day-track[data-calendar-day="${day}"]`, 13, true); expect(await saved('past')).toEqual(before);
  await drag(page, 'past', `.schedule-day-track[data-calendar-day="${day}"]`, 13); expect(await saved('past')).toMatchObject({ next: day + 'T13:00', nextEnd: '14:30', due: before.due, memo: before.memo, start: before.start, end: before.end });
  await expect(page.locator('[data-outside-task="past"]')).toHaveCount(0); await page.getByRole('button', { name: '変更を元に戻す', exact: true }).click(); await expect(page.locator('[data-outside-task="past"]')).toBeVisible();
  await drag(page, 'undated', `.schedule-day-track[data-calendar-day="${day}"]`, 15); expect(await saved('undated')).toMatchObject({ quick: true, next: day + 'T15:00', nextEnd: '15:30', due: '' });
  await page.reload(); await page.locator('.sidebar').getByRole('button', { name: 'カレンダー', exact: true }).click(); await expect(page.locator('.schedule-event[data-calendar-task="undated"]')).toHaveCount(1);
  await page.getByRole('button', { name: '月', exact: true }).click(); await page.getByRole('complementary', { name: '表示範囲外のTask' }).getByRole('button', { name: '締切日', exact: true }).click(); await drag(page, 'undated', `.cal-day[data-calendar-day="${day}"]`); expect(await saved('undated')).toMatchObject({ due: day, next: day + 'T15:00', nextEnd: '15:30' });
});
test('deadline drops affect only due dates, daily headers accept tray drops and rejected saves keep source Tasks', async ({ page }) => {
  const tray = page.getByRole('complementary', { name: '表示範囲外のTask' }); await tray.getByRole('button', { name: '締切日', exact: true }).click(); const original = await saved('past');
  await drag(page, 'past', `.schedule-day-track[data-calendar-day="${day}"]`, 13); expect(await saved('past')).toEqual(original);
  await drag(page, 'past', `[data-calendar-due-day="${day}"]`); expect(await saved('past')).toMatchObject({ due: day, next: original.next, nextEnd: original.nextEnd, memo: original.memo });
  await page.getByRole('button', { name: '変更を元に戻す', exact: true }).click(); await page.getByRole('button', { name: '日', exact: true }).click(); await drag(page, 'past', `[data-calendar-due-day="${day}"]`); expect((await saved('past')).due).toBe(day);
  await tray.getByRole('button', { name: '対応予定日', exact: true }).click(); const pending = await saved('undated'); await page.route('**/api/tasks/undated', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({error:'保存拒否'}) }));
  await drag(page, 'undated', `.schedule-day-track[data-calendar-day="${day}"]`, 14); expect(await saved('undated')).toEqual(pending); await expect(tray.locator('[data-outside-task="undated"]')).toBeVisible(); await expect(page.locator('.calendar-feedback')).toContainText('保存できません');
});
