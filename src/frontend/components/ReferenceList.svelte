<script lang="ts">
  import type { Reference } from '../../shared/model.js';
  import { referenceTarget } from '../../shared/references.js';
  let { items = $bindable([]), label, disabled = false }: { items?: Reference[]; label: string; disabled?: boolean } = $props();
  let message = $state('');
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); message = 'リンク先をコピーしました。'; }
    catch { message = 'コピーできませんでした。リンク先の入力欄からコピーしてください。'; }
  }
</script>
<div class="section-heading"><h3>{label}</h3><button class="ghost" type="button" {disabled} onclick={() => items = [...items, { id: crypto.randomUUID(), url: '', summary: '' }]}>＋ {label === '資料リンク' ? '資料' : 'チャット'}を追加</button></div>
{#each items as entry, index (entry.id)}
  {@const target = referenceTarget(entry.url)}
  <div class="reference-box">
    <div class="reference-box-head"><strong>{label === '資料リンク' ? '資料' : 'チャット'} {index + 1}</strong><button type="button" class="link-danger" {disabled} aria-label={`${label} ${index + 1}を削除`} onclick={() => items = items.filter(item => item.id !== entry.id)}>削除</button></div>
    <div class="form-group"><label class="form-label" for={`reference-${entry.id}`}>リンク先（URL／パス）</label><input id={`reference-${entry.id}`} class="form-input" bind:value={entry.url} placeholder="https://... またはローカルの絶対パス" {disabled} /></div>
    <div class="form-group"><label class="form-label" for={`summary-${entry.id}`}>概要</label><textarea id={`summary-${entry.id}`} class="form-textarea" bind:value={entry.summary} {disabled}></textarea></div>
    <div class="reference-actions">{#if target}<a href={target.href} target="_blank" rel="noopener noreferrer" class="reference-open">↗ {target.kind === 'local' ? 'ローカルのリンクを開く' : 'リンクを開く'}</a>{/if}<button type="button" class="ghost" disabled={disabled || !entry.url} onclick={() => copy(entry.url)}>リンク先をコピー</button></div>
    {#if target?.kind === 'local'}<p class="form-hint">ブラウザから開けない場合はパスをコピーして、Explorer／Finderなどで開いてください。</p>{:else if entry.url && !target}<p class="form-warning">HTTP(S) URLかローカルの絶対パスを入力してください。</p>{/if}
  </div>
{:else}<div class="empty">{label}はまだありません。上の追加ボタンから登録できます。</div>{/each}
{#if message}<p class="selection-info" role="status">{message}</p>{/if}
