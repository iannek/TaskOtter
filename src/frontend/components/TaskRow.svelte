<script lang="ts">
import TaskCheck from './TaskCheck.svelte';
import { overflow, rangeText, dateLabel, type Task, type Outcome } from '../../shared/model.js';
let { task, outcomes, open, save, disabled = false, end = 'status' }: { task: Task; outcomes: Outcome[]; open: (task: Task) => void; save: (task: Task) => Promise<void>; disabled?: boolean; end?: string } = $props();
function rowClick(event: MouseEvent) { if (!(event.target as HTMLElement).closest('button,input,select,textarea,a')) open(task); }
</script>
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions (行の空白も開けるようにし、子のチェック操作は独立させる) -->
<div class="task-row" tabindex="0" onclick={rowClick} onkeydown={(event) => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); open(task); } }}>
  <TaskCheck {task} {disabled} {save} /><div class="row-main"><button class="row-title two-line-title" title={task.name} onclick={() => open(task)}>{task.name}</button><div class="row-sub">{outcomes.find(o => o.id === task.outcomeId)?.name || 'Outcomeなし'} · {task.category || 'カテゴリなし'}{#if end === 'next' && task.nextAction} · {task.nextAction}{/if}</div></div>
  {#if overflow(task, outcomes)}<span class="warning" title="Outcomeの期間からはみ出しています">⚠ 期間外</span>{/if}
  {#if end === 'next'}<span class="row-end" class:warning={task.next.slice(0, 10) < new Date().toLocaleDateString('sv-SE')}>{dateLabel(task.next.slice(0, 10))}<span class="schedule-time-label">{task.next.slice(11)}–{task.nextEnd}</span></span>
  {:else if end === 'range'}<span class="row-end">{rangeText(task)}</span>
  {:else}<span class="badge {task.status}">{task.status}</span>{/if}
</div>
