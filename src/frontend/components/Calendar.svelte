<script lang="ts">
import { onMount, tick } from 'svelte';
import TaskCheck from './TaskCheck.svelte';
import { addDays, dateLabel, localDate, layoutSchedule, minute, newTask, type Task } from '../../shared/model.js';
import { clock, snappedMinute, moveSchedule, resizeSchedule } from '../../shared/calendar.js';
let { tasks, open, save, disabled, timeStep, setStep }: { tasks: Task[]; open: (t: Task) => void; save: (task: Task) => Promise<void>; disabled: boolean; timeStep: number; setStep: (step: number) => Promise<void> } = $props();
let mode = $state('week'), cursor = $state(localDate()), showDone = $state(false);
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
  if (drag?.active || (event instanceof PointerEvent && event.pointerType === 'touch')) return;
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
function openTask(task: Task) { if (disabled || saving || performance.now() < suppressedUntil) return; hideTooltip(); open(task); }
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
  cancelDrag();
  const d = new Date(`${cursor}T12:00`);
  if (mode === 'month') { d.setDate(1); d.setMonth(d.getMonth() + direction); cursor = localDate(d); }
  else cursor = addDays(cursor, direction * (mode === 'week' ? 7 : 1));
}
function timeScroll(node: HTMLElement, displayMode: string) {
  // Keep the 8:00 label fully visible below the sticky date/deadline header.
  const reset = () => { node.scrollTop = 8 * pixelsPerHour - 12; };
  reset();
  return { update(nextMode: string) { if (nextMode !== displayMode) { displayMode = nextMode; reset(); } } };
}
function due(day: string) { return visible.filter(t => t.due === day); }
function schedules(day: string) { return visible.filter(t => t.next.slice(0, 10) === day); }
type CalendarChange = Partial<Pick<Task, 'next' | 'nextEnd' | 'due'>>;
type Drag = { task: Task; source: HTMLElement; pointerId: number; kind: 'next' | 'due'; edge: '' | 'start' | 'end'; x0: number; y0: number; x: number; y: number; grab: number; step: number; day: string; active: boolean };
type Drop = { cell: HTMLElement; day: string; range?: { start: number; end: number } };
let drag: Drag | null = null;
let scrollFrame = 0, suppressedUntil = 0;
let marker: HTMLDivElement | null = null, highlighted: HTMLElement | null = null;
let root: HTMLDivElement;
let ghost = $state<{ name: string; heading: string; x: number; y: number; valid: boolean } | null>(null);
let saving = $state(false), feedback = $state('');
let undo = $state<{ id: string; before: CalendarChange; after: CalendarChange } | null>(null);
let canUndo = $derived(!!undo && tasks.some(task => task.id === undo!.id && Object.entries(undo!.after).every(([key, value]) => task[key as keyof CalendarChange] === value)));
function edgeAt(node: HTMLElement, y: number): '' | 'start' | 'end' {
  if (!node.classList.contains('schedule-event')) return '';
  const r = node.getBoundingClientRect(), band = Math.min(7, r.height / 4);
  return y >= r.top && y <= r.top + band ? 'start' : y <= r.bottom && y >= r.bottom - band ? 'end' : '';
}
function clearMarker() { marker?.remove(); marker = null; highlighted?.classList.remove('calendar-drop-day'); highlighted = null; }
function dropAt(x: number, y: number): Drop | null {
  if (!drag) return null;
  const selector = drag.kind === 'due' && mode === 'week' ? '[data-calendar-due-day]' : drag.kind === 'due' ? '.cal-day[data-calendar-day]' : '.schedule-day-track[data-calendar-day],.cal-day[data-calendar-day]';
  const cell = document.elementsFromPoint(x, y).map(el => el.closest<HTMLElement>(selector)).find(el => el && root.contains(el));
  if (!cell) return null;
  const day = cell.dataset.calendarDueDay || cell.dataset.calendarDay!;
  if (drag.kind === 'due') return { cell, day };
  if (cell.classList.contains('cal-day')) return { cell, day, range: { start: minute(drag.task.next.slice(11)), end: minute(drag.task.nextEnd) } };
  if (drag.edge && day !== drag.day) return null;
  const raw = (y - cell.getBoundingClientRect().top) / pixelsPerHour * 60 - drag.grab;
  const range = drag.edge ? resizeSchedule(drag.task.next.slice(11), drag.task.nextEnd, drag.edge, raw, drag.step) : moveSchedule(drag.task.next.slice(11), drag.task.nextEnd, raw, drag.step);
  return { cell, day, range };
}
function previewDrag() {
  if (!drag?.active) return;
  clearMarker();
  const drop = dropAt(drag.x, drag.y);
  const heading = drop ? drag.kind === 'due' ? `締切 ${dateLabel(drop.day)}` : `${dateLabel(drop.day)} ${clock(drop.range!.start)}–${clock(drop.range!.end)}` : drag.kind === 'due' ? '締切欄へ移動してください' : 'カレンダー内へ移動してください';
  ghost = { name: drag.task.name, heading, valid: !!drop, x: Math.max(12, Math.min(innerWidth - 300, drag.x + 16)), y: Math.max(12, Math.min(innerHeight - 130, drag.y + 16)) };
  if (drop) {
    if (drag.kind === 'due' || drop.cell.classList.contains('cal-day')) { highlighted = drop.cell; highlighted.classList.add('calendar-drop-day'); }
    else {
      marker = document.createElement('div'); marker.className = 'calendar-drop-preview';
      marker.style.top = `${drop.range!.start / 60 * pixelsPerHour}px`; marker.style.height = `${(drop.range!.end - drop.range!.start) / 60 * pixelsPerHour}px`;
      marker.textContent = `${clock(drop.range!.start)}–${clock(drop.range!.end)}`; drop.cell.append(marker);
    }
  }
}
function autoScroll() {
  if (!drag?.active) return;
  const scroll = root.querySelector<HTMLElement>('.schedule-scroll,.calendar-month'), r = scroll?.getBoundingClientRect();
  if (scroll && r && drag.x >= r.left && drag.x <= r.right && drag.y >= r.top && drag.y <= r.bottom) {
    if (drag.y > r.bottom - 32) scroll.scrollTop += 10; else if (drag.y < r.top + 32 && drag.kind !== 'due') scroll.scrollTop -= 10;
    if (drag.x > r.right - 32) scroll.scrollLeft += 10; else if (drag.x < r.left + 32) scroll.scrollLeft -= 10;
    previewDrag();
  }
  scrollFrame = requestAnimationFrame(autoScroll);
}
function clearDrag() {
  const previous = drag; drag = null;
  cancelAnimationFrame(scrollFrame); clearMarker(); ghost = null;
  previous?.source.classList.remove('calendar-drag-source');
  document.body.classList.remove('calendar-drag-active', 'calendar-resize-active');
  if (previous?.source.hasPointerCapture(previous.pointerId)) previous.source.releasePointerCapture(previous.pointerId);
}
function cancelDrag() { if (drag?.active) suppressedUntil = performance.now() + 350; clearDrag(); }
function beginDrag(event: PointerEvent, node: HTMLElement, task: Task, due: boolean) {
  if (disabled || saving || event.button !== 0 || (event.target as HTMLElement).closest('input') || (due && mode === 'day')) return;
  const edge = due ? '' : edgeAt(node, event.clientY), r = node.getBoundingClientRect();
  drag = { task, source: node, kind: due ? 'due' : 'next', edge, pointerId: event.pointerId, x0: event.clientX, y0: event.clientY, x: event.clientX, y: event.clientY, grab: node.classList.contains('schedule-event') ? (event.clientY - (edge === 'end' ? r.bottom : r.top)) / pixelsPerHour * 60 : 0, step: timeStep, day: task.next.slice(0, 10), active: false };
}
function moveDrag(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  drag.x = event.clientX; drag.y = event.clientY;
  if (!drag.active && Math.hypot(drag.x - drag.x0, drag.y - drag.y0) < 6) return;
  if (!drag.active) {
    drag.active = true; hideTooltip(); drag.source.classList.add('calendar-drag-source');
    drag.source.setPointerCapture(event.pointerId); document.body.classList.add('calendar-drag-active');
    if (drag.edge) document.body.classList.add('calendar-resize-active');
    scrollFrame = requestAnimationFrame(autoScroll);
  }
  event.preventDefault(); previewDrag();
}
async function commit(task: Task, change: CalendarChange, remember = true) {
  if (disabled || saving) return;
  const before: CalendarChange = {};
  for (const key of Object.keys(change) as (keyof CalendarChange)[]) before[key] = task[key];
  if (Object.entries(change).every(([key, value]) => task[key as keyof CalendarChange] === value)) { return; }
  saving = true;
  try {
    await save({ ...task, ...change });
    undo = remember ? { id: task.id, before, after: change } : null;
    feedback = '';
  } catch { feedback = '保存できませんでした。日時は変更していません。'; }
  finally { saving = false; }
}
function finishDrag(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!drag.active) { clearDrag(); return; }
  drag.x = event.clientX; drag.y = event.clientY;
  const pending = drag, drop = dropAt(event.clientX, event.clientY);
  suppressedUntil = performance.now() + 350; clearDrag();
  if (!drop || disabled) return;
  // Save the latest task object so an unrelated edit cannot be overwritten.
  const task = tasks.find(t => t.id === pending.task.id);
  if (!task) return;
  const change = pending.kind === 'due' ? { due: drop.day } : { next: `${drop.day}T${clock(drop.range!.start)}`, nextEnd: clock(drop.range!.end) };
  void commit(task, change);
}
async function changeStep(event: Event) {
  const select = event.currentTarget as HTMLSelectElement;
  try { await setStep(Number(select.value)); } catch { /* The application displays the API error. */ }
  finally { await tick(); select.value = String(timeStep); }
}
function undoChange() {
  if (!undo || !canUndo) return;
  const task = tasks.find(task => task.id === undo!.id);
  if (task) void commit(task, undo.before, false);
}
function taskArea(node: HTMLElement, value: { task: Task; due: boolean }) {
  const down = (event: PointerEvent) => beginDrag(event, node, value.task, value.due);
  const hover = (event: PointerEvent) => { if (!drag?.active) node.classList.toggle('calendar-edge-hover', !disabled && !saving && !(event.target as HTMLElement).closest('input') && !!edgeAt(node, event.clientY)); };
  const leave = () => node.classList.remove('calendar-edge-hover');
  const click = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest('button,input')) { event.stopPropagation(); openTask(value.task); } };
  node.addEventListener('pointerdown', down); node.addEventListener('pointermove', hover); node.addEventListener('pointerleave', leave); node.addEventListener('click', click);
  return { update(next: typeof value) { value = next; }, destroy() { node.removeEventListener('pointerdown', down); node.removeEventListener('pointermove', hover); node.removeEventListener('pointerleave', leave); node.removeEventListener('click', click); } };
}
function blankArea(node: HTMLElement, day: string) {
  const add = (event: MouseEvent) => {
    if (disabled || saving || drag?.active || performance.now() < suppressedUntil || (event.target as HTMLElement).closest('[data-calendar-task],button,input,select,textarea,a')) return;
    const task = newTask();
    if (node.classList.contains('schedule-day-track')) {
      const start = snappedMinute((event.clientY - node.getBoundingClientRect().top) / pixelsPerHour * 60, timeStep);
      task.next = `${day}T${clock(start)}`; task.nextEnd = clock(Math.min(1439, start + 30));
    } else task.next = day;
    hideTooltip(); open(task);
  };
  const preview = (event: PointerEvent) => {
    if (drag?.active) return;
    clearMarker();
    if (disabled || saving || event.pointerType === 'touch' || !node.classList.contains('schedule-day-track') || (event.target as HTMLElement).closest('[data-calendar-task],button,input,select,textarea,a')) return;
    const start = snappedMinute((event.clientY - node.getBoundingClientRect().top) / pixelsPerHour * 60, timeStep);
    marker = document.createElement('div'); marker.className = 'calendar-drop-preview add-preview';
    marker.style.top = `${start / 60 * pixelsPerHour}px`; marker.textContent = `＋ ${clock(start)}に追加（ダブルクリック）`; node.append(marker);
  };
  const leave = () => { if (!drag?.active) clearMarker(); };
  node.addEventListener('dblclick', add); node.addEventListener('pointermove', preview); node.addEventListener('pointerleave', leave);
  return { update(value: string) { day = value; }, destroy() { node.removeEventListener('dblclick', add); node.removeEventListener('pointermove', preview); node.removeEventListener('pointerleave', leave); } };
}
$effect(() => { if (disabled) cancelDrag(); });
onMount(() => {
  const click = (event: MouseEvent) => { if (performance.now() < suppressedUntil && root.contains(event.target as Node)) { event.preventDefault(); event.stopImmediatePropagation(); } };
  const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancelDrag(); };
  window.addEventListener('pointermove', moveDrag, { passive: false }); window.addEventListener('pointerup', finishDrag); window.addEventListener('pointercancel', cancelDrag);
  window.addEventListener('blur', cancelDrag); window.addEventListener('keydown', key); window.addEventListener('click', click, true); window.addEventListener('dblclick', click, true);
  return () => { clearDrag(); window.removeEventListener('pointermove', moveDrag); window.removeEventListener('pointerup', finishDrag); window.removeEventListener('pointercancel', cancelDrag); window.removeEventListener('blur', cancelDrag); window.removeEventListener('keydown', key); window.removeEventListener('click', click, true); window.removeEventListener('dblclick', click, true); };
});

</script>
<svelte:window onresize={hideTooltip} onblur={hideTooltip} onpointerdown={hideTooltip} />
{#snippet taskButton(task: Task, className: string, label: string, due = false)}
  <button class={className} aria-describedby={tooltip?.anchor === undefined || tooltip?.task !== task ? undefined : tooltipId}
    onpointerenter={(event) => showTooltip(event, task, due)} onpointerleave={leaveTooltip}
    onfocus={(event) => showTooltip(event, task, due)} onblur={leaveTooltip} onclick={() => openTask(task)}>{label}</button>
{/snippet}
<div bind:this={root} class="calendar-view">
<div class="calendar-actions"><label>時刻の刻み <select aria-label="追加・移動の時刻の刻み" value={timeStep} disabled={disabled || saving} onchange={changeStep}><option value="15">15分</option><option value="30">30分</option></select></label><button class="secondary" disabled={disabled || saving || !canUndo} onclick={undoChange}>変更を元に戻す</button></div>
{#if feedback}<p class="calendar-feedback" role="status">{feedback}</p>{/if}
<div class="toolbar"><div>{#each [['day', '日'], ['week', '週'], ['month', '月']] as [value, label]}<button class="chip-button" class:active={mode === value} onclick={() => { cancelDrag(); mode = value; }}>{label}</button>{/each}</div><label class="selection-info"><input type="checkbox" bind:checked={showDone} /> Doneも表示</label><span class="spacer"></span><button class="icon-button" aria-label="前の期間" onclick={() => move(-1)}>‹</button><button class="secondary" onclick={() => { cancelDrag(); cursor = today; }}>今日</button><button class="icon-button" aria-label="次の期間" onclick={() => move(1)}>›</button><strong>{mode === 'week' ? `${days[0]} – ${days[6]}` : cursor.slice(0, mode === 'day' ? 10 : 7)}</strong></div>
{#if mode === 'month'}
<section class="panel calendar-month"><div class="calendar-grid">{#each ['日', '月', '火', '水', '木', '金', '土'] as d}<div class="cal-weekday">{d}</div>{/each}{#each days as day}<div data-calendar-day={day} use:blankArea={day} class="cal-day" class:other={day.slice(0, 7) !== cursor.slice(0, 7)} class:today={day === today}><div class="cal-num">{Number(day.slice(8))}</div>{#each due(day) as t (t.id)}<div data-calendar-task={t.id} data-calendar-kind="due" use:taskArea={{task: t, due: true}} class="calendar-check-event calendar-due-area"><TaskCheck task={t} {disabled} {save} /><div class="calendar-task-copy">{@render taskButton(t, 'cal-event due', `◆ 締切 ${t.name}`, true)}</div></div>{/each}{#each schedules(day) as t (t.id)}<div data-calendar-task={t.id} data-calendar-kind="next" use:taskArea={{task: t, due: false}} class="calendar-check-event calendar-next-area"><TaskCheck task={t} {disabled} {save} /><div class="calendar-task-copy">{@render taskButton(t, 'cal-event next', `${t.next.slice(11)}–${t.nextEnd} ${t.name}`)}</div></div>{/each}</div>{/each}</div></section>
{:else}
<section class="panel schedule-scroll" use:timeScroll={mode}><div class="schedule-grid" style={`--days:${days.length};--minwidth:${68 + days.length * trackWidth}px`}><div class="schedule-corner">時刻</div>{#each days as day}<div data-calendar-due-day={day} class="schedule-day-head" class:today={day === today}><strong>{dateLabel(day)}</strong>{#each due(day) as t (t.id)}<div data-calendar-task={t.id} data-calendar-kind="due" use:taskArea={{task: t, due: true}} class="calendar-check-event calendar-due-area" class:calendar-due-static={mode === 'day'}><TaskCheck task={t} {disabled} {save} /><div class="calendar-task-copy">{@render taskButton(t, 'schedule-due', `◆ ${t.name}`, true)}</div></div>{:else}<span class="schedule-no-due">締切なし</span>{/each}</div>{/each}<div class="schedule-hour-gutter">{#each Array.from({ length: 25 }, (_, i) => i) as hour}<span class="schedule-hour" class:last={hour === 24} style={`top:${hour * pixelsPerHour}px`}>{hour}:00</span>{/each}</div>{#each days as day, index}<div data-calendar-day={day} use:blankArea={day} class="schedule-day-track" class:today={day === today}>{#each layouts[index] as event (event.task.id)}<div data-calendar-task={event.task.id} data-calendar-kind="next" use:taskArea={{task: event.task, due: false}} class="schedule-event" class:short-event={(minute(event.task.nextEnd) - minute(event.task.next.slice(11))) < 30} style={`top:${minute(event.task.next.slice(11)) / 60 * pixelsPerHour}px;height:${(minute(event.task.nextEnd) - minute(event.task.next.slice(11))) / 60 * pixelsPerHour}px;left:calc(${event.column / event.columns * 100}% + 2px);width:calc(${100 / event.columns}% - 4px);right:auto`} ><TaskCheck task={event.task} {disabled} {save} /><div class="calendar-task-copy">{@render taskButton(event.task, 'schedule-event-open', `${event.task.next.slice(11)}–${event.task.nextEnd} ${event.task.name}`)}</div></div>{/each}</div>{/each}</div></section><p class="time-legend">空白をダブルクリックすると新規Taskを開きます。予定の上下の端で時間を変更、中央で移動。◆ 締切は週の上部欄へ移動できます。</p>
{/if}
</div>

{#if ghost}<div class="calendar-drag-ghost" class:invalid={!ghost.valid} style={`left:${ghost.x}px;top:${ghost.y}px`}><strong>{ghost.heading}</strong><span>{ghost.name}</span></div>{/if}
{#if tooltip}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions (ホバーで開いた説明をポインター移動中も保持する) -->
  <div bind:this={popup} id={tooltipId} class="calendar-full-tooltip" role="tooltip" style={`left:${tooltipLeft}px;top:${tooltipTop}px`} onpointerenter={cancelHide} onpointerleave={leaveTooltip}>
    <strong>{tooltip.heading}</strong><p>{tooltip.task.name}</p>
  </div>
{/if}
