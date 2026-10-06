<script lang="ts">
  import { tick } from 'svelte';
  import type { Outcome } from '../../shared/model.js';
  let { value = $bindable(''), newName = $bindable(''), outcomes, disabled = false }: { value?: string; newName?: string; outcomes: Outcome[]; disabled?: boolean } = $props();
  let expanded = $state(false), creating = $state(false), name = $state('');
  let field: HTMLDivElement, trigger: HTMLButtonElement;
  let input = $state<HTMLInputElement>();
  let selected = $derived(outcomes.find(o => o.id === value));
  let matches = $derived(outcomes.filter(o => o.name.trim() === name.trim()));
  function choose(id: string) { value = id; newName = ''; expanded = false; creating = false; trigger.focus(); }
  async function create() { creating = true; name = newName; await tick(); input?.focus(); }
  function useNew() { if (!name.trim() || matches.length) return; newName = name.trim(); value = ''; expanded = false; creating = false; trigger.focus(); }
  function outside(event: PointerEvent) { if (expanded && !field.contains(event.target as Node)) { expanded = false; creating = false; } }
  function keyboard(event: KeyboardEvent) { if (expanded && event.key === 'Escape') { event.preventDefault(); expanded = false; creating = false; trigger.focus(); } }
</script>
<svelte:window onpointerdown={outside} onkeydown={keyboard} />
<div class="category-field" bind:this={field}>
  <button bind:this={trigger} id="outcome" type="button" class="form-input date-trigger" aria-label="Outcome" aria-expanded={expanded} {disabled} onclick={() => { expanded = !expanded; creating = false; }}><span>{newName ? `${newName}（新規）` : selected?.name || 'Outcomeを選択'}</span><span aria-hidden="true">▾</span></button>
  {#if newName}<p class="form-hint">タスク保存時に作成します。期間なし・未完了。</p>{/if}
  {#if expanded}<div class="category-options" aria-label="Outcome一覧">
    {#if creating}
      <label class="form-label" for="new-outcome-name">新しいOutcome名</label><input bind:this={input} id="new-outcome-name" class="form-input" bind:value={name} {disabled} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); useNew(); } }} />
      {#if matches.length}<p class="form-hint">同名のOutcomeがあります。既存のものを選択してください。</p>{#each matches as outcome}<button type="button" class="category-choice" {disabled} onclick={() => choose(outcome.id)}>{outcome.name} · {outcome.complete ? '完了' : '進行中'} · {outcome.id.slice(0, 8)}</button>{/each}{/if}
      <div class="category-actions"><button type="button" class="secondary" {disabled} onclick={() => creating = false}>戻る</button><button type="button" class="primary" disabled={disabled || !name.trim() || !!matches.length} onclick={useNew}>このOutcomeを使う</button></div>
    {:else}
      <button type="button" class="category-choice" aria-pressed={!value && !newName} {disabled} onclick={() => choose('')}>Outcomeなし {!value && !newName ? '✓' : ''}</button>
      {#each outcomes as outcome}<button type="button" class="category-choice" aria-pressed={!newName && value === outcome.id} {disabled} onclick={() => choose(outcome.id)}>{outcome.name} · {outcome.complete ? '完了' : '進行中'}{outcomes.filter(o => o.name === outcome.name).length > 1 ? ` · $${outcome.id.slice(0, 8)}` : ''} {value === outcome.id && !newName ? '✓' : ''}</button>{/each}
      {#if !outcomes.length}<p class="form-hint">Outcomeはまだありません。</p>{/if}
      <button type="button" class="category-choice category-create" {disabled} onclick={create}>＋ 新しいOutcomeを作成</button>
    {/if}
  </div>{/if}
</div>
