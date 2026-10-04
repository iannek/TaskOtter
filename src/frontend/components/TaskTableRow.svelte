<script lang="ts">
  import TaskCheck from './TaskCheck.svelte';
  import DatePicker from './DatePicker.svelte';
  import TimePicker from './TimePicker.svelte';
  import { statuses, dateLabel, rangeText, overflow, type Task, type Outcome } from '../../shared/model.js';
  let { task, outcomes, timeStep, disabled, open, save }: { task: Task; outcomes: Outcome[]; timeStep: number; disabled: boolean; open: (task: Task) => void; save: (task: Task) => Promise<void> } = $props();
  let editing = $state<'range' | 'due' | 'next' | null>(null), message = $state('');
  let start = $state(''), end = $state(''), due = $state(''), day = $state(''), from = $state(''), to = $state('');
  let rangeCandidate = $derived({ ...task, start: start || (end ? 'before' : ''), end: end || (start ? 'after' : '') });
  function edit(field: 'range' | 'due' | 'next') {
    if (disabled) return;
    editing = editing === field ? null : field; message = '';
    start = task.start === 'before' ? '' : task.start; end = task.end === 'after' ? '' : task.end;
    due = task.due; day = task.next.slice(0, 10); from = task.next.slice(11); to = task.nextEnd;
  }
  function rowClick(event: MouseEvent) {
    if (!(event.target as HTMLElement).closest('button,input,select,textarea,a')) open(task);
  }
  async function changeStatus(event: Event) {
    const select = event.target as HTMLSelectElement;
    const status = select.value as Task['status']; message = '';
    try { await save({ ...task, status }); } catch (error) { message = (error as Error).message; }
    finally { select.value = task.status; }
  }
  async function submit(event: SubmitEvent) {
    event.preventDefault(); if (disabled) return; message = '';
    let candidate = { ...task };
    if (editing === 'range') {
      if (start && end && start > end) { message = '終了日は開始日以降にしてください。'; return; }
      candidate.start = start || (end ? 'before' : ''); candidate.end = end || (start ? 'after' : '');
    } else if (editing === 'due') candidate.due = due;
    else if (editing === 'next') {
      if ((day || from || to) && !(day && from && to)) { message = '日付・開始時刻・終了時刻をすべて指定してください。'; return; }
      if (from && from >= to) { message = '終了時刻は開始時刻より後にしてください。'; return; }
      candidate.next = day ? `${day}T${from}` : ''; candidate.nextEnd = to;
    }
    try { await save(candidate); editing = null; } catch (error) { message = (error as Error).message; }
  }
</script>
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (表の行をEnterでも開けるようにする) -->
<tr class="child-row" tabindex="0" aria-label={`${task.name}の詳細`} onclick={rowClick} onkeydown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(task); } }}>
  <td class="task-name-column"><div class="task-cell"><TaskCheck {task} {disabled} {save} /><div class="task-cell-name"><button class="row-title two-line-title" title={task.name} onclick={() => open(task)}>{task.name}</button>{#if task.materials?.length || task.chats?.length || task.subtasks?.length}<div class="task-detail-counts">資料 {task.materials?.length || 0} · チャット {task.chats?.length || 0} · サブタスク {task.subtasks?.filter(row => row.complete).length || 0}/{task.subtasks?.length || 0}</div>{/if}</div></div>{#if overflow(task, outcomes)}<span class="warning">⚠ Outcomeの期間外</span>{/if}</td>
  <td><select class={`inline-status badge ${task.status}`} aria-label={`${task.name}のステータス`} {disabled} onchange={changeStatus}>{#each statuses as status}<option selected={task.status === status}>{status}</option>{/each}</select></td>
  <td>{task.category || '—'}</td>
  <td><button class="inline-field" aria-label={`${task.name}の対応予定期間を編集`} aria-expanded={editing === 'range'} {disabled} onclick={() => edit('range')}>{rangeText(task)}</button></td>
  <td><button class="inline-field" aria-label={`${task.name}の締切日を編集`} aria-expanded={editing === 'due'} {disabled} onclick={() => edit('due')}>{task.due ? dateLabel(task.due) : '—'}</button></td>
  <td><button class="inline-field schedule-field" aria-label={`${task.name}の次の対応予定を編集`} aria-expanded={editing === 'next'} {disabled} onclick={() => edit('next')}>{#if task.next}<span>{dateLabel(task.next.slice(0, 10))}</span><span class="schedule-time-label">{task.next.slice(11)}–{task.nextEnd}</span>{:else}—{/if}</button></td>
  <td></td>
</tr>
{#if editing || message}
<tr class="inline-edit-row"><td colspan="7">
  {#if editing}<form class="inline-edit-form" aria-label={`${task.name}の行内編集`} onsubmit={submit}>
    <fieldset {disabled}>
      <strong>{task.name} · {editing === 'range' ? '対応予定期間' : editing === 'due' ? '締切日' : '次の対応予定'}</strong>
      <div class="inline-edit-fields">
      {#if editing === 'range'}
        <div><label class="form-label" for={`start-${task.id}`}>開始日</label><DatePicker id={`start-${task.id}`} label="行内の期間開始日" bind:value={start} {disabled} /></div>
        <div><label class="form-label" for={`end-${task.id}`}>終了日</label><DatePicker id={`end-${task.id}`} label="行内の期間終了日" bind:value={end} {disabled} /></div>
      {:else if editing === 'due'}<div><span class="form-label">締切日</span><DatePicker label="行内の締切日" bind:value={due} {disabled} /></div>
      {:else}
        <div><span class="form-label">日付</span><DatePicker label="行内の予定日" bind:value={day} {disabled} /></div>
        <div><span class="form-label">開始時刻</span><TimePicker label="行内の開始時刻" bind:value={from} step={timeStep} {disabled} /></div>
        <div><span class="form-label">終了時刻</span><TimePicker label="行内の終了時刻" bind:value={to} step={timeStep} {disabled} /></div>
      {/if}
      </div>
      {#if editing === 'range'}<p class="form-hint">開始日だけならその日以降、終了日だけならその日以前。両方空欄なら期間なし。</p>{/if}
      {#if editing === 'range' && overflow(rangeCandidate, outcomes)}<div class="form-warning" role="status">⚠ Outcomeの期間からはみ出しています。保存は可能です。</div>{/if}
      <div class="inline-edit-actions"><button type="button" class="ghost" onclick={() => { if (editing === 'range') { start = ''; end = ''; } else if (editing === 'due') due = ''; else { day = ''; from = ''; to = ''; } }}>解除</button><span class="spacer"></span><button type="button" class="secondary" onclick={() => { editing = null; message = ''; }}>キャンセル</button><button class="primary">保存</button></div>
    </fieldset>
  </form>{/if}
  {#if message}<p class="form-error" role="alert">{message}</p>{/if}
</td></tr>
{/if}
