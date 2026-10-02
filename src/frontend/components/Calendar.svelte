<script lang="ts">
import { addDays, dateLabel, localDate, layoutSchedule, minute, type Task } from '../../shared/model.js';
let { tasks, open }: { tasks: Task[]; open: (t: Task) => void } = $props();
let mode = $state('month'), cursor = $state(localDate()), showDone = $state(false);
const today = localDate();
let visible = $derived(tasks.filter(t => showDone || t.status !== 'Done'));
let days = $derived.by(() => {
  const d = new Date(`${cursor}T12:00`);
  if (mode === 'day') return [cursor];
  if (mode === 'month') d.setDate(1);
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: mode === 'month' ? 42 : 7 }, (_, i) => addDays(localDate(d), i));
});
let layouts = $derived(days.map(day => layoutSchedule(schedules(day))));
let trackWidth = $derived(Math.max(120, ...layouts.map(events => Math.max(1, ...events.map(event => event.columns)) * 80)));
function move(direction: number) {
  const d = new Date(`${cursor}T12:00`);
  if (mode === 'month') { d.setDate(1); d.setMonth(d.getMonth() + direction); cursor = localDate(d); }
  else cursor = addDays(cursor, direction * (mode === 'week' ? 7 : 1));
}
function due(day: string) { return visible.filter(t => t.due === day); }
function schedules(day: string) { return visible.filter(t => t.next.slice(0, 10) === day); }
</script>
<div class="toolbar"><div>{#each [['day', '日'], ['week', '週'], ['month', '月']] as [value, label]}<button class="chip-button" class:active={mode === value} onclick={() => mode = value}>{label}</button>{/each}</div><label class="selection-info"><input type="checkbox" bind:checked={showDone} /> Doneも表示</label><span class="spacer"></span><button class="icon-button" aria-label="前の期間" onclick={() => move(-1)}>‹</button><button class="secondary" onclick={() => cursor = today}>今日</button><button class="icon-button" aria-label="次の期間" onclick={() => move(1)}>›</button><strong>{mode === 'week' ? `${days[0]} – ${days[6]}` : cursor.slice(0, mode === 'day' ? 10 : 7)}</strong></div>
{#if mode === 'month'}
<section class="panel"><div class="calendar-grid">{#each ['日', '月', '火', '水', '木', '金', '土'] as d}<div class="cal-weekday">{d}</div>{/each}{#each days as day}<div class="cal-day" class:other={day.slice(0, 7) !== cursor.slice(0, 7)} class:today={day === today}><div class="cal-num">{Number(day.slice(8))}</div>{#each due(day) as t}<button class="cal-event due" onclick={() => open(t)}>◆ 締切 {t.name}</button>{/each}{#each schedules(day) as t}<button class="cal-event next" onclick={() => open(t)}>{t.next.slice(11)}–{t.nextEnd} {t.name}</button>{/each}</div>{/each}</div></section>
{:else}
<section class="panel schedule-scroll"><div class="schedule-grid" style={`--days:${days.length};--minwidth:${68 + days.length * trackWidth}px`}><div class="schedule-corner">時刻</div>{#each days as day}<div class="schedule-day-head" class:today={day === today}><strong>{dateLabel(day)}</strong>{#each due(day) as t}<button class="schedule-due" onclick={() => open(t)}>◆ {t.name}</button>{:else}<span class="schedule-no-due">締切なし</span>{/each}</div>{/each}<div class="schedule-hour-gutter">{#each Array.from({ length: 25 }, (_, i) => i) as hour}<span class="schedule-hour" class:last={hour === 24} style={`top:${hour * 48}px`}>{hour}:00</span>{/each}</div>{#each days as day, index}<div class="schedule-day-track" class:today={day === today}>{#each layouts[index] as event}<button class="schedule-event" style={`top:${minute(event.task.next.slice(11)) / 60 * 48}px;height:${(minute(event.task.nextEnd) - minute(event.task.next.slice(11))) / 60 * 48}px;left:calc(${event.column / event.columns * 100}% + 2px);width:calc(${100 / event.columns}% - 4px);right:auto`} title={`${event.task.next.slice(11)}–${event.task.nextEnd} ${event.task.name}`} onclick={() => open(event.task)}>{event.task.next.slice(11)}–{event.task.nextEnd} {event.task.name}</button>{/each}</div>{/each}</div></section><p class="time-legend">◆ 締切を上部に表示。時間帯が重なる予定は横に並べます。0:00～24:00までスクロールできます。</p>
{/if}
