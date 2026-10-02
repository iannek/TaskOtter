<script lang="ts">
import DatePicker from './DatePicker.svelte';
import { addDays, dateLabel, dayDistance, localDate, overflow, rangeText, statuses, type Data, type Task, type Outcome } from '../../shared/model.js';
let { data, openTask, openOutcome }: { data: Data; openTask: (t: Task) => void; openOutcome: (o: Outcome) => void } = $props();
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
<div class="row-legend"><span class="kind-tag outcome-kind">OUTCOME</span> 親の成果 <span class="kind-tag task-kind">TASK</span> 作業</div>
<section class="panel table-wrap"><div class="gantt-shell" class:month={period === 'month'} style={`--gantt-days:${days.length};--gantt-width:${Math.max(680, days.length * (period === 'month' ? 28 : 60))}px;--gantt-day-width:${100 / days.length}%;--gantt-cell-min:${period === 'month' ? 28 : 60}px`}><div class="gantt-label-head">Outcome / Task</div><div class="gantt-time-head">{#each days as d}<div class="day-head" class:today={d === today}><strong>{#if period === 'month'}<span>{dateLabel(d).split('(')[0]}</span><span>({dateLabel(d).split('(')[1]}</span>{:else}{dateLabel(d)}{/if}</strong></div>{/each}</div>
  <div>{#each groups as g}{#if g.o || g.children.length}{#if g.o}<button class="gantt-label parent outcome-label" aria-label={`${g.o.name}の詳細`} onclick={() => openOutcome(g.o!)}><span class="kind-tag outcome-kind">OUTCOME</span><span class="gantt-task-name">{g.o.name}</span><span class="selection-info">{g.children.length}</span></button>{:else}<div class="gantt-label parent"><span class="kind-tag outcome-kind">未分類</span>Outcomeなし<span class="selection-info">{g.children.length}</span></div>{/if}{#each g.children as t}<button class="gantt-label child" aria-label={`${t.name}の詳細`} onclick={() => openTask(t)}><span class="kind-tag task-kind">TASK</span><span class="row-dot {t.status}"></span><span class="gantt-task-name">{t.name}</span>{#if overflow(t, data.outcomes)}<span class="warning" title="Outcomeの期間外">⚠</span>{/if}</button>{/each}{/if}{/each}</div>
  <div>{#each groups as g}{#if g.o || g.children.length}{#if g.o}<button class="gantt-track parent outcome-track" aria-label={`${g.o.name}の期間から詳細を開く`} onclick={() => openOutcome(g.o!)}>{#if bar(g.o)}<span class="bar parent" style={bar(g.o)} title={rangeText(g.o)}></span>{/if}</button>{:else}<div class="gantt-track parent"></div>{/if}{#each g.children as t}<button class="gantt-track task-track" aria-label={t.name} onclick={() => openTask(t)}>{#if bar(t)}<span class="bar" class:warn={overflow(t, data.outcomes)} class:open-left={t.start === 'before' || t.start < days[0]} class:open-right={t.end === 'after' || t.end > days[days.length - 1]} style={bar(t)} title={rangeText(t)}></span>{/if}</button>{/each}{/if}{/each}</div>
</div></section><p class="page-subtitle" style="margin-top:12px">⚠ はOutcomeの期間外を示します。Taskを選択するとサイドバーで編集できます。</p>
