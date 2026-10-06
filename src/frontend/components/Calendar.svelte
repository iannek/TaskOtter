<script lang="ts">
import { onMount, tick } from 'svelte';
import TaskCheck from './TaskCheck.svelte';
import { addDays, dateLabel, localDate, layoutSchedule, minute, type Task } from '../../shared/model.js';
let { tasks, open, save, disabled }: { tasks: Task[]; open: (t: Task) => void; save: (task: Task) => Promise<void>; disabled: boolean } = $props();
let mode = $state('month'), cursor = $state(localDate()), showDone = $state(false);
const today = localDate();
const pixelsPerHour = 96;
const componentId = $props.id();
const tooltipId = componentId + '-calendar-tooltip';
let tooltip = $state<{ task: Task; heading: string; anchor: HTMLButtonElement; anchorLeft: number; anchorTop: number } | null>(null);
let popup = $state<HTMLDivElement>();
let tooltipLeft = $state(12), tooltipTop = $state(12);
let hideTimer: ReturnType<typeof setTimeout> | undefined;
function cancelHide() { clearTimeout(hideTimer); }
function hideTooltip() { cancelHide(); tooltip = null; }
function leaveTooltip() { cancelHide(); hideTimer = setTimeout(hideTooltip, 150); }
async function showTooltip(event: PointerEvent | FocusEvent, task: Task, due = false) {
  if (event instanceof PointerEvent && event.pointerType === 'touch') return;
  cancelHide();
  const anchor = event.currentTarget as HTMLButtonElement;
  const bounds = anchor.getBoundingClientRect();
  const next = { task, anchorLeft: bounds.left, anchorTop: bounds.top, heading: due ? `締切 ${dateLabel(task.due)}` : `${dateLabel(task.next.slice(0, 10))} ${task.next.slice(11)}–${task.nextEnd}`, anchor };
  tooltip = next; tooltipLeft = 12; tooltipTop = 12;
  await tick();
  if (tooltip?.anchor !== anchor || tooltip.task.id !== task.id || !popup) return;
  const size = popup.getBoundingClientRect();
  tooltipLeft = Math.max(12, Math.min(window.innerWidth - size.width - 12, bounds.left));
  const below = bounds.bottom + 8;
  tooltipTop = Math.max(12, Math.min(window.innerHeight - size.height - 12, below + size.height <= window.innerHeight - 12 ? below : bounds.top - size.height - 8));
}
function openTask(task: Task) { hideTooltip(); open(task); }
$effect(() => { mode; cursor; showDone; tasks; hideTooltip(); });
onMount(() => {
  const scroll = (event: Event) => {
    if (!tooltip || popup?.contains(event.target as Node)) return;
    const bounds = tooltip.anchor.getBoundingClientRect();
    if (Math.abs(bounds.left - tooltip.anchorLeft) > 0.5 || Math.abs(bounds.top - tooltip.anchorTop) > 0.5) hideTooltip();
  };
  const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hideTooltip(); };
  window.addEventListener('scroll', scroll, true);
  window.addEventListener('keydown', key);
  return () => { cancelHide(); window.removeEventListener('scroll', scroll, true); window.removeEventListener('keydown', key); };
});
let visible = $derived(tasks.filter(t => showDone || t.status !== 'Done'));
let days = $derived.by(() => {
  const d = new Date(`${cursor}T12:00`);
  if (mode === 'day') return [cursor];
  if (mode === 'month') d.setDate(1);
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: mode === 'month' ? 42 : 7 }, (_, i) => addDays(localDate(d), i));
});
let layouts = $derived(days.map(day => layoutSchedule(schedules(day))));
let trackWidth = $derived(Math.max(240, ...layouts.map(events => Math.max(1, ...events.map(event => event.columns)) * 160)));
function move(direction: number) {
  const d = new Date(`${cursor}T12:00`);
  if (mode === 'month') { d.setDate(1); d.setMonth(d.getMonth() + direction); cursor = localDate(d); }
  else cursor = addDays(cursor, direction * (mode === 'week' ? 7 : 1));
}
function due(day: string) { return visible.filter(t => t.due === day); }
function schedules(day: string) { return visible.filter(t => t.next.slice(0, 10) === day); }
</script>
<svelte:window onresize={hideTooltip} onblur={hideTooltip} onpointerdown={hideTooltip} />
{#snippet taskButton(task: Task, className: string, label: string, due = false)}
  <button class={className} aria-describedby={tooltip?.anchor === undefined || tooltip?.task !== task ? undefined : tooltipId}
    onpointerenter={(event) => showTooltip(event, task, due)} onpointerleave={leaveTooltip}
    onfocus={(event) => showTooltip(event, task, due)} onblur={leaveTooltip} onclick={() => openTask(task)}>{label}</button>
{/snippet}
<div class="toolbar"><div>{#each [['day', '日'], ['week', '週'], ['month', '月']] as [value, label]}<button class="chip-button" class:active={mode === value} onclick={() => mode = value}>{label}</button>{/each}</div><label class="selection-info"><input type="checkbox" bind:checked={showDone} /> Doneも表示</label><span class="spacer"></span><button class="icon-button" aria-label="前の期間" onclick={() => move(-1)}>‹</button><button class="secondary" onclick={() => cursor = today}>今日</button><button class="icon-button" aria-label="次の期間" onclick={() => move(1)}>›</button><strong>{mode === 'week' ? `${days[0]} – ${days[6]}` : cursor.slice(0, mode === 'day' ? 10 : 7)}</strong></div>
{#if mode === 'month'}
<section class="panel calendar-month"><div class="calendar-grid">{#each ['日', '月', '火', '水', '木', '金', '土'] as d}<div class="cal-weekday">{d}</div>{/each}{#each days as day}<div class="cal-day" class:other={day.slice(0, 7) !== cursor.slice(0, 7)} class:today={day === today}><div class="cal-num">{Number(day.slice(8))}</div>{#each due(day) as t}<div class="calendar-check-event"><TaskCheck task={t} {disabled} {save} /><div class="calendar-task-copy">{@render taskButton(t, 'cal-event due', `◆ 締切 ${t.name}`, true)}</div></div>{/each}{#each schedules(day) as t}<div class="calendar-check-event"><TaskCheck task={t} {disabled} {save} /><div class="calendar-task-copy">{@render taskButton(t, 'cal-event next', `${t.next.slice(11)}–${t.nextEnd} ${t.name}`)}</div></div>{/each}</div>{/each}</div></section>
{:else}
<section class="panel schedule-scroll"><div class="schedule-grid" style={`--days:${days.length};--minwidth:${68 + days.length * trackWidth}px`}><div class="schedule-corner">時刻</div>{#each days as day}<div class="schedule-day-head" class:today={day === today}><strong>{dateLabel(day)}</strong>{#each due(day) as t}<div class="calendar-check-event"><TaskCheck task={t} {disabled} {save} /><div class="calendar-task-copy">{@render taskButton(t, 'schedule-due', `◆ ${t.name}`, true)}</div></div>{:else}<span class="schedule-no-due">締切なし</span>{/each}</div>{/each}<div class="schedule-hour-gutter">{#each Array.from({ length: 25 }, (_, i) => i) as hour}<span class="schedule-hour" class:last={hour === 24} style={`top:${hour * pixelsPerHour}px`}>{hour}:00</span>{/each}</div>{#each days as day, index}<div class="schedule-day-track" class:today={day === today}>{#each layouts[index] as event}<div class="schedule-event" class:short-event={(minute(event.task.nextEnd) - minute(event.task.next.slice(11))) < 30} style={`top:${minute(event.task.next.slice(11)) / 60 * pixelsPerHour}px;height:${(minute(event.task.nextEnd) - minute(event.task.next.slice(11))) / 60 * pixelsPerHour}px;left:calc(${event.column / event.columns * 100}% + 2px);width:calc(${100 / event.columns}% - 4px);right:auto`} ><TaskCheck task={event.task} {disabled} {save} /><div class="calendar-task-copy">{@render taskButton(event.task, 'schedule-event-open', `${event.task.next.slice(11)}–${event.task.nextEnd} ${event.task.name}`)}</div></div>{/each}</div>{/each}</div></section><p class="time-legend">◆ 締切を上部に表示。時間帯が重なる予定は横に並べます。0:00～24:00までスクロールできます。</p>
{/if}

{#if tooltip}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions (ホバーで開いた説明をポインター移動中も保持する) -->
  <div bind:this={popup} id={tooltipId} class="calendar-full-tooltip" role="tooltip" style={`left:${tooltipLeft}px;top:${tooltipTop}px`} onpointerenter={cancelHide} onpointerleave={leaveTooltip}>
    <strong>{tooltip.heading}</strong><p>{tooltip.task.name}</p>
  </div>
{/if}
