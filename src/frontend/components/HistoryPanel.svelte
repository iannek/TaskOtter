<script lang="ts">
  import { dateTimeLabel, type Task, type Outcome } from '../../shared/model.js';
  let { item }: { item: Task | Outcome } = $props();
  let entries = $derived((item.history || []).map((entry, index) => ({ ...entry, index })).sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.index - a.index));
</script>
<div class="history-heading"><h3>更新履歴</h3><span class="pill">{entries.length} 件</span></div>
<p class="history-caption">新しい順 · 日時は端末の時刻で表示</p>
{#if entries.length}<ol class="history-list">{#each entries as entry}<li class="history-entry"><time datetime={entry.at} title={entry.at}>{dateTimeLabel(entry.at)}</time><p>{entry.summary}</p></li>{/each}</ol>
{:else}<div class="history-empty">{#if item.id}履歴はまだありません。<br />次に内容を変更して保存した時点から記録します。{:else}作成すると、日時と作成記録が自動で追加されます。{/if}</div>{/if}
