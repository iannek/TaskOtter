<script lang="ts">
  import { onMount, tick } from 'svelte';
  let { value = $bindable(''), step, label, disabled = false }: { value?: string; step: number; label: string; disabled?: boolean } = $props();
  let open = $state(false), left = $state(0), top = $state(0);
  let field: HTMLDivElement, trigger: HTMLButtonElement;
  let popup = $state<HTMLDivElement>();
  let scrollPositions = new Map<EventTarget, string>();
  function scrollPosition(target: EventTarget | null) { return target instanceof HTMLElement ? `${target.scrollLeft}:${target.scrollTop}` : `${window.scrollX}:${window.scrollY}`; }
  const options = $derived(Array.from({ length: 1440 / step }, (_, i) => `${String(Math.floor(i * step / 60)).padStart(2, '0')}:${String(i * step % 60).padStart(2, '0')}`));
  async function toggle() {
    if (open) { open = false; return; }
    // The browser may dispatch a queued scroll from bringing the trigger into view.
    // Close only when an ancestor actually moves after opening.
    scrollPositions = new Map([[document, scrollPosition(document)]]);
    for (let parent: HTMLElement | null = field; parent; parent = parent.parentElement) scrollPositions.set(parent, scrollPosition(parent));
    const bounds = trigger.getBoundingClientRect();
    left = Math.max(8, Math.min(bounds.left, window.innerWidth - Math.min(300, window.innerWidth - 16) - 8));
    top = bounds.bottom + 6; open = true;
    await tick();
    if (!open || !popup) return;
    const height = popup.getBoundingClientRect().height;
    top = bounds.bottom + height + 6 > window.innerHeight ? Math.max(8, bounds.top - height - 6) : bounds.bottom + 6;
    await tick();
    if (!open || !popup) return;
    const active = popup.querySelector<HTMLButtonElement>('.active');
    active?.scrollIntoView({ block: 'nearest' });
    (active || popup.querySelector<HTMLButtonElement>('.time-options button'))?.focus({ preventScroll: true });
  }
  function outside(event: PointerEvent) { if (open && !field.contains(event.target as Node)) open = false; }
  function keyboard(event: KeyboardEvent) {
    if (open && event.key === 'Escape') { event.preventDefault(); open = false; trigger.focus(); }
  }
  function select(time: string) { value = time; open = false; trigger.focus(); }
  onMount(() => {
    function scroll(event: Event) {
      if (!open || (event.target instanceof Node && popup?.contains(event.target))) return;
      if (event.target && scrollPositions.get(event.target) === scrollPosition(event.target)) return;
      open = false;
    }
    document.addEventListener('scroll', scroll, true);
    return () => document.removeEventListener('scroll', scroll, true);
  });
</script>
<svelte:window onpointerdown={outside} onkeydown={keyboard} onresize={() => open = false} />
<div class="time-field" bind:this={field}>
  <button bind:this={trigger} type="button" class="time-trigger" aria-label={label} aria-expanded={open} aria-haspopup="dialog" {disabled} onclick={toggle}>{value || '時刻を選択'}</button>
  {#if open}
    <div bind:this={popup} class="time-popover" role="dialog" aria-label={label} style={`left:${left}px;top:${top}px`}>
      <div class="time-popover-head"><strong>{label} · {step}分間隔</strong><button type="button" class="ghost" onclick={() => open = false}>閉じる</button></div>
      <div class="time-options">{#each options as time}<button type="button" class:active={time === value} onclick={() => select(time)}>{time}</button>{/each}</div>
      <button type="button" class="ghost" onclick={() => select('')}>時刻を解除</button>
    </div>
  {/if}
</div>
