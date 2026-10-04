<script lang="ts">
import TaskCheck from './TaskCheck.svelte';
import DatePicker from './DatePicker.svelte';
import { addDays, monthSegments, dateLabel, dayDistance, localDate, overflow, rangeText, statuses, type Data, type Task, type Outcome } from '../../shared/model.js';
let { data, openTask, openOutcome, addTask, disabled, save }: { data: Data; openTask: (t: Task) => void; openOutcome: (o: Outcome) => void; addTask: (outcomeId: string) => void; disabled: boolean; save: (task: Task) => Promise<void> } = $props();
let status = $state('all'), category = $state('all'), sort = $state('name');
let period = $state('fortnight'), anchor = $state(localDate()), customStart = $state(localDate()), customEnd = $state(addDays(localDate(), 13)), appliedStart = $state(localDate()), appliedEnd = $state(addDays(localDate(), 13)), rangeError = $state('');
const today = localDate();
let bounds = $derived.by(() => {
  if (period === 'custom') return [appliedStart, appliedEnd];
  if (period === 'month') {
    const d = new Date(`${anchor}T12:00`); d.setDate(1); const first = localDate(d); d.setMonth(d.getMonth() + 1); d.setDate(0); return [first, localDate(d)];
  }
  const d = new Date(`${anchor}T12:00`), first = addDays(anchor, -((d.getDay() + 6) % 7));
  return [first, addDays(first, period === 'week' ? 6 : 13)];
});
let days = $derived(Array.from({ length: dayDistance(bounds[0], bounds[1]) + 1 }, (_, i) => addDays(bounds[0], i)));
let months = $derived(monthSegments(days));
function move(direction: number) {
  if (period === 'custom') { const count = days.length; const nextStart = addDays(appliedStart, direction * count), nextEnd = addDays(appliedEnd, direction * count); appliedStart = nextStart; appliedEnd = nextEnd; customStart = appliedStart; customEnd = appliedEnd; }
  else if (period === 'month') { const d = new Date(`${anchor}T12:00`); d.setDate(1); d.setMonth(d.getMonth() + direction); anchor = localDate(d); }
  else anchor = addDays(anchor, direction * (period === 'week' ? 7 : 14));
  rangeError = '';
}
function resetToday() { anchor = today; if (period === 'custom') { const count = days.length; appliedStart = today; appliedEnd = addDays(today, count - 1); customStart = appliedStart; customEnd = appliedEnd; } rangeError = ''; }
function applyRange() {
  if (!customStart || !customEnd) { rangeError = '表示開始日と表示終了日を指定してください。'; return; }
  if (customStart > customEnd) { rangeError = '表示終了日は表示開始日以降にしてください。'; return; }
  appliedStart = customStart; appliedEnd = customEnd; rangeError = '';
}
let categories = $derived([...new Set(data.tasks.map(t => t.category).filter(Boolean))]);
let items = $derived(data.tasks.filter(t => (status === 'all' || t.status === status) && (category === 'all' || t.category === category)).sort((a, b) => sort === 'status' ? statuses.indexOf(a.status) - statuses.indexOf(b.status) : sort === 'category' ? a.category.localeCompare(b.category, 'ja') : a.name.localeCompare(b.name, 'ja')));
let groups = $derived([...data.outcomes.map(o => ({ o: o as Outcome | null, children: items.filter(t => t.outcomeId === o.id) })).filter(g => g.children.length || !g.o!.complete), { o: null, children: items.filter(t => !t.outcomeId) }]);
function bar(item: { start: string; end: string }) {
  if (!item.start || !item.end) return '';
  const a = item.start === 'before' ? days[0] : item.start, b = item.end === 'after' ? days[days.length - 1] : item.end;
  if (a > days[days.length - 1] || b < days[0]) return '';
  const start = Math.max(0, dayDistance(days[0], a)), end = Math.min(days.length - 1, dayDistance(days[0], b));
  return `left:${start / days.length * 100}%;width:${(end - start + 1) / days.length * 100}%`;
}
</script>
<div class="toolbar"><label class="selection-info">表示期間 <select class="field" aria-label="ガントの表示期間" bind:value={period}><option value="week">1週間</option><option value="fortnight">2週間</option><option value="month">1ヶ月</option><option value="custom">日付指定</option></select></label><select class="field" aria-label="ガントのステータス" bind:value={status}><option value="all">全ステータス</option>{#each statuses as s}<option>{s}</option>{/each}</select><select class="field" aria-label="ガントのカテゴリ" bind:value={category}><option value="all">全カテゴリ</option>{#each categories as c}<option>{c}</option>{/each}</select><select class="field" aria-label="表示順" bind:value={sort}><option value="name">名前順</option><option value="status">ステータス順</option><option value="category">カテゴリ順</option></select><span class="spacer"></span><button class="icon-button" aria-label="前の期間" onclick={() => move(-1)}>‹</button><button class="secondary" onclick={resetToday}>今日</button><button class="icon-button" aria-label="次の期間" onclick={() => move(1)}>›</button><span class="selection-info">{days[0]} – {days[days.length - 1]}</span></div>
{#if period === 'custom'}<div class="toolbar gantt-range"><div><span class="form-label">表示開始日</span><DatePicker label="ガントの表示開始日" bind:value={customStart} /></div><div><span class="form-label">表示終了日</span><DatePicker label="ガントの表示終了日" bind:value={customEnd} /></div><button class="primary" onclick={applyRange}>期間を適用</button></div>{#if rangeError}<p class="form-error" role="alert">{rangeError}</p>{/if}{/if}

<section class="panel table-wrap"><div class="gantt-shell grouped-months" class:month={period === 'month'} style={`--gantt-days:${days.length};--gantt-width:${Math.max(680, days.length * (period === 'month' ? 28 : 60))}px;--gantt-day-width:${100 / days.length}%;--gantt-cell-min:${period === 'month' ? 28 : 60}px`}><div class="gantt-label-head">Outcome / Task</div><div class="gantt-time-head"><div class="gantt-month-head" style={`grid-template-columns:repeat(${days.length},minmax(0,1fr))`}>{#each months as month}<div class="gantt-month" style={`grid-column:${month.offset + 1}/span ${month.count}`}>{month.month.slice(0, 4)}年 {Number(month.month.slice(5))}月</div>{/each}</div><div class="gantt-day-head" style={`grid-template-columns:repeat(${days.length},minmax(0,1fr))`}>{#each days as day}<div class="day-head" class:today={day === today} class:weekend={[0, 6].includes(new Date(`${day}T12:00`).getDay())} title={`${day.slice(0,4)}/${dateLabel(day)}`}><strong>{Number(day.slice(8))}</strong></div>{/each}</div></div>
  <div>{#each groups as g}{#if g.o}<div class="gantt-parent-label"><button class="group-add" {disabled} aria-label={`${g.o.name}にTaskを追加`} title="このOutcomeにTaskを追加" onclick={() => addTask(g.o!.id)}>＋</button><button class="gantt-label parent outcome-label" aria-label={`${g.o.name}の詳細`} title={g.o.name} onclick={() => openOutcome(g.o!)}><span class="gantt-task-name two-line-title">{g.o.name}</span></button></div>{:else}<div class="gantt-label parent"><span class="group-add-placeholder"></span>Outcomeなし</div>{/if}{#each g.children as t}<div class="gantt-label child"><TaskCheck task={t} {disabled} {save} /><button class="gantt-task-name two-line-title" aria-label={`${t.name}の詳細`} title={t.name} onclick={() => openTask(t)}>{t.name}</button>{#if overflow(t, data.outcomes)}<span class="warning" title="Outcomeの期間外">⚠</span>{/if}</div>{/each}{/each}</div>
  <div>{#each groups as g}{#if g.o}<button class="gantt-track parent outcome-track" aria-label={`${g.o.name}の期間から詳細を開く`} onclick={() => openOutcome(g.o!)}>{#each months.slice(1) as month}<span class="gantt-month-boundary" style={`left:${month.offset / days.length * 100}%`}></span>{/each}{#if bar(g.o)}<span class="bar parent" style={bar(g.o)} title={rangeText(g.o)}></span>{/if}</button>{:else}<div class="gantt-track parent">{#each months.slice(1) as month}<span class="gantt-month-boundary" style={`left:${month.offset / days.length * 100}%`}></span>{/each}</div>{/if}{#each g.children as t}<button class="gantt-track task-track" aria-label={t.name} onclick={() => openTask(t)}>{#each months.slice(1) as month}<span class="gantt-month-boundary" style={`left:${month.offset / days.length * 100}%`}></span>{/each}{#if bar(t)}<span class="bar" class:warn={overflow(t, data.outcomes)} class:open-left={t.start === 'before' || t.start < days[0]} class:open-right={t.end === 'after' || t.end > days[days.length - 1]} style={bar(t)} title={rangeText(t)}></span>{/if}</button>{/each}{/each}</div>
</div></section><p class="page-subtitle" style="margin-top:12px">⚠ はOutcomeの期間外を示します。Taskを選択するとサイドバーで編集できます。</p>
