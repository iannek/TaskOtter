<script lang="ts">
  import { tick } from 'svelte';
  import { addDays, localDate, dateLabel } from '../../shared/model.js';
  let { value = $bindable(''), label, id, disabled = false }: { value?: string; label: string; id?: string; disabled?: boolean } = $props();
  let expanded = $state(false), month = $state(localDate().slice(0, 7)), left = $state(0), top = $state(0);
  let field: HTMLDivElement, trigger: HTMLButtonElement;
  let popup = $state<HTMLDivElement>();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  let days = $derived.by(() => {
    const first = `${month}-01`;
    return Array.from({ length: 42 }, (_, i) => addDays(first, i - new Date(`${first}T12:00`).getDay()));
  });
  async function toggle() {
    if (expanded) { expanded = false; return; }
    month = (value || localDate()).slice(0, 7);
    const bounds = trigger.getBoundingClientRect();
    left = Math.max(8, Math.min(bounds.left, window.innerWidth - 288));
    top = bounds.bottom + 6;
    expanded = true;
    await tick();
    if (!expanded || !popup) return;
    const height = popup.getBoundingClientRect().height;
    top = bounds.bottom + height + 6 > window.innerHeight ? Math.max(8, bounds.top - height - 6) : bounds.bottom + 6;
    popup.querySelector<HTMLButtonElement>(`[data-day="${value || localDate()}"]`)?.focus();
  }
  function move(direction: number) {
    const d = new Date(`${month}-01T12:00`); d.setMonth(d.getMonth() + direction); month = localDate(d).slice(0, 7);
  }
  function select(day: string) { value = day; expanded = false; trigger.focus(); }
  function outside(event: PointerEvent) { if (expanded && !field.contains(event.target as Node)) expanded = false; }
  async function keyboard(event: KeyboardEvent) {
    if (!expanded) return;
    if (event.key === 'Escape') { event.preventDefault(); expanded = false; trigger.focus(); return; }
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const day = (event.target as HTMLElement).dataset.day;
    if (day && event.key in offsets) {
      event.preventDefault(); const next = addDays(day, offsets[event.key]); month = next.slice(0, 7);
      await tick(); popup?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus();
    }
  }
</script>
<svelte:window onpointerdown={outside} onkeydown={keyboard} onresize={() => expanded = false} />
<div class="date-field" bind:this={field}>
  <button bind:this={trigger} {id} type="button" class="field date-trigger" aria-label={label} aria-expanded={expanded} aria-haspopup="dialog" {disabled} onclick={toggle}><span>{value ? `${value.slice(0, 4)}/${dateLabel(value)}` : '-'}</span><span aria-hidden="true">▦</span></button>
  {#if expanded}
    <div bind:this={popup} class="date-popover" role="dialog" aria-label={`${label}を選択`} style={`left:${left}px;top:${top}px`}>
      <div class="date-picker-head"><button type="button" class="icon-button" aria-label="前の月" onclick={() => move(-1)}>‹</button><strong>{Number(month.slice(0, 4))}年 {Number(month.slice(5))}月</strong><button type="button" class="icon-button" aria-label="次の月" onclick={() => move(1)}>›</button></div>
      <div class="date-picker-grid">{#each weekdays as day}<span>{day}</span>{/each}{#each days as day}<button type="button" class:other={day.slice(0, 7) !== month} class:selected={day === value} class:today={day === localDate()} aria-label={day} aria-pressed={day === value} data-day={day} onclick={() => select(day)}>{Number(day.slice(8))}</button>{/each}</div>
      <div class="date-picker-foot"><button type="button" class="ghost" onclick={() => select(localDate())}>今日を選択</button><button type="button" class="ghost" onclick={() => select('')}>日付を解除</button></div>
    </div>
  {/if}
</div>
