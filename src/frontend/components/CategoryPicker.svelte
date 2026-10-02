<script lang="ts">
  import { tick } from 'svelte';
  let { value = $bindable(''), categories, disabled = false }: { value?: string; categories: string[]; disabled?: boolean } = $props();
  let expanded = $state(false), creating = $state(false), name = $state('');
  let field: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let input = $state<HTMLInputElement>();
  let choices = $derived([...new Set([...categories, value].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja')));
  function choose(category: string) { value = category; expanded = false; creating = false; trigger.focus(); }
  async function create() { creating = true; name = ''; await tick(); input?.focus(); }
  function outside(event: PointerEvent) { if (expanded && !field.contains(event.target as Node)) { expanded = false; creating = false; } }
  function keyboard(event: KeyboardEvent) { if (expanded && event.key === 'Escape') { event.preventDefault(); expanded = false; creating = false; trigger.focus(); } }
</script>
<svelte:window onpointerdown={outside} onkeydown={keyboard} />
<div class="category-field" bind:this={field}>
  <button bind:this={trigger} id="category" type="button" class="form-input date-trigger" aria-label="カテゴリ" aria-expanded={expanded} {disabled} onclick={() => { expanded = !expanded; creating = false; }}><span>{value || 'カテゴリを選択'}</span><span aria-hidden="true">▾</span></button>
  <p class="form-hint">一覧から選択、または新しく作成できます。</p>
  {#if expanded}
    <div class="category-options" aria-label="カテゴリ一覧">
      {#if creating}
        <label class="form-label" for="new-category">新しいカテゴリ名</label><input bind:this={input} id="new-category" class="form-input" bind:value={name} {disabled} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (name.trim()) choose(name.trim()); } }} />
        <div class="category-actions"><button type="button" class="secondary" {disabled} onclick={() => creating = false}>戻る</button><button type="button" class="primary" disabled={disabled || !name.trim()} onclick={() => choose(name.trim())}>このカテゴリを使う</button></div>
      {:else}
        <button type="button" class="category-choice" aria-pressed={!value} {disabled} onclick={() => choose('')}>カテゴリなし {value ? '' : '✓'}</button>
        {#each choices as category}<button type="button" class="category-choice" aria-pressed={value === category} {disabled} onclick={() => choose(category)}>{category} {value === category ? '✓' : ''}</button>{/each}
        {#if !choices.length}<p class="form-hint">使用中のカテゴリはありません。</p>{/if}
        <button type="button" class="category-choice category-create" {disabled} onclick={create}>＋ 新しいカテゴリを作成</button>
      {/if}
    </div>
  {/if}
</div>
