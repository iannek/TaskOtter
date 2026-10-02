<script lang="ts">
import { overflow, rangeText, type Task, type Outcome } from '../../shared/model.js';
let { task, outcomes, open, end = 'status' }: { task: Task; outcomes: Outcome[]; open: (task: Task) => void; end?: string } = $props();
</script>
<button type="button" class="task-row" aria-label={task.name} onclick={() => open(task)}>
  <span class="row-dot {task.status}"></span><div class="row-main"><span class="row-title">{task.name}</span><div class="row-sub">{outcomes.find(o => o.id === task.outcomeId)?.name || 'Outcomeなし'} · {task.category || 'カテゴリなし'}</div></div>
  {#if overflow(task, outcomes)}<span class="warning" title="Outcomeの期間からはみ出しています">⚠ 期間外</span>{/if}
  {#if end === 'next'}<span class="row-end" class:warning={task.next.slice(0, 10) < new Date().toLocaleDateString('sv-SE')}>{task.next.replace('T', ' ')}–{task.nextEnd}</span>
  {:else if end === 'range'}<span class="row-end">{rangeText(task)}</span>
  {:else}<span class="badge {task.status}">{task.status}</span>{/if}
</button>
