<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import DatePicker from './DatePicker.svelte';
  import TimePicker from './TimePicker.svelte';
  import CategoryPicker from './CategoryPicker.svelte';
  import OutcomePicker from './OutcomePicker.svelte';
  import { statuses, overflow, type Task, type Outcome, type Data } from '../../shared/model.js';
  let { kind, item, data, busy, disabled, save, remove, close, width = $bindable(470) }: { kind: 'tasks' | 'outcomes'; item: Task | Outcome; data: Data; busy: boolean; disabled: boolean; save: (item: Task | Outcome, newOutcomeName?: string) => Promise<void>; remove: () => Promise<void>; close: () => void; width?: number } = $props();
  let draft = $state(untrack(() => structuredClone($state.snapshot(item))));
  let task = $derived(draft as Task);
  let outcome = $derived(draft as Outcome);
  let startDate = $state(untrack(() => item.start === 'before' ? '' : item.start));
  let endDate = $state(untrack(() => item.end === 'after' ? '' : item.end));
  let nextDate = $state(untrack(() => kind === 'tasks' ? (item as Task).next.slice(0, 10) : ''));
  let nextStart = $state(untrack(() => kind === 'tasks' ? (item as Task).next.slice(11) : ''));
  let nextEnd = $state(untrack(() => kind === 'tasks' ? (item as Task).nextEnd : ''));
  let message = $state(''), newOutcomeName = $state('');
  let dialog: HTMLDialogElement;
  let viewport = $state(1024), resizing = $state(false);
  let resizeX = 0, resizeWidth = 0, backdropPressed = false;
  let minimum = $derived(Math.min(320, Math.max(0, viewport - 24)));
  let maximum = $derived(Math.max(minimum, viewport - 24));
  let actualWidth = $derived(Math.min(maximum, Math.max(minimum, width)));
  function outside(event: PointerEvent) { const r = dialog.getBoundingClientRect(); return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom; }
  function beginResize(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault(); resizeX = event.clientX; resizeWidth = actualWidth; resizing = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function resize(event: PointerEvent) { if (resizing) width = Math.min(maximum, Math.max(minimum, resizeWidth + resizeX - event.clientX)); }
  function resizeKey(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); width = event.key === 'Home' ? minimum : event.key === 'End' ? maximum : Math.min(maximum, Math.max(minimum, actualWidth + (event.key === 'ArrowLeft' ? 20 : -20)));
  }
  onMount(() => { dialog.showModal(); document.getElementById('edit-name')?.focus(); });
  let candidate = $derived({ ...task, start: startDate || (kind === 'tasks' && endDate ? 'before' : ''), end: endDate || (kind === 'tasks' && startDate ? 'after' : '') });
  let children = $derived(item.id ? data.tasks.filter(t => t.outcomeId === item.id) : []);
  let canComplete = $derived(children.every(t => t.status === 'Done'));
  async function submit(event: SubmitEvent) {
    event.preventDefault(); message = '';
    if (disabled || busy) return;
    if (kind === 'outcomes' && !!startDate !== !!endDate) { message = 'Outcomeの期間は開始日・終了日の両方を設定してください。'; return; }
    if (candidate.start && candidate.end && candidate.start !== 'before' && candidate.end !== 'after' && candidate.start > candidate.end) { message = '終了日は開始日以降にしてください。'; return; }
    if (kind === 'tasks' && (nextDate || nextStart || nextEnd) && !(nextDate && nextStart && nextEnd)) { message = '次の対応予定の日付・開始時刻・終了時刻をすべて指定してください。'; return; }
    if (kind === 'tasks' && nextStart && nextStart >= nextEnd) { message = '終了時刻は同じ日の開始時刻より後にしてください。'; return; }
    const value = { ...draft, name: draft.name.trim(), start: candidate.start, end: candidate.end };
    if (!value.name) { message = '名前を入力してください。'; return; }
    if (kind === 'tasks') Object.assign(value, { next: nextDate ? `${nextDate}T${nextStart}` : '', nextEnd });
    try { await save(value, newOutcomeName || undefined); } catch (e) { message = (e as Error).message; }
  }
</script>
<svelte:window bind:innerWidth={viewport} />
<dialog bind:this={dialog} class="drawer" class:resizing style={`width:${actualWidth}px`} onpointerdown={(e) => backdropPressed = outside(e)} onpointerup={(e) => { if (backdropPressed && outside(e) && !busy && !resizing) close(); backdropPressed = false; }} aria-labelledby="editor-title" oncancel={(e) => { e.preventDefault(); if (!busy) close(); }}>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (ARIAのフォーカス可能な区切りでキーボードによる幅調整を提供する) -->
  <div class="drawer-resizer" role="separator" tabindex="0" aria-label="サイドバーの幅" aria-orientation="vertical" aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={Math.round(actualWidth)} onpointerdown={beginResize} onpointermove={resize} onpointerup={() => resizing = false} onlostpointercapture={() => resizing = false} onkeydown={resizeKey}></div>
  <div class="drawer-head"><div><div class="eyebrow">{kind === 'tasks' ? 'TASK' : 'OUTCOME'}</div><h2 id="editor-title">{item.id ? '詳細を編集' : '新規作成'}</h2></div><button class="icon-button drawer-close" aria-label="閉じる" disabled={busy} onclick={close}>×</button></div>
  <form id="detail-form" class="drawer-body" onsubmit={submit}>
    <fieldset disabled={disabled || busy}>
      <div class="form-group"><label class="form-label" for="edit-name">{kind === 'tasks' ? 'Task名' : 'Outcome名'}</label><input id="edit-name" class="form-input" bind:value={draft.name} required /></div>
      {#if kind === 'tasks'}
        <div class="form-grid"><div class="form-group"><label for="status" class="form-label">ステータス</label><select id="status" class="form-select" bind:value={task.status}>{#each statuses as s}<option>{s}</option>{/each}</select></div><div class="form-group"><label for="category" class="form-label">カテゴリ</label><CategoryPicker bind:value={task.category} categories={data.tasks.map(t => t.category)} disabled={disabled || busy} /></div></div>
        <div class="form-group"><label for="outcome" class="form-label">Outcome</label><OutcomePicker bind:value={task.outcomeId} bind:newName={newOutcomeName} outcomes={data.outcomes} disabled={disabled || busy} />{#if task.status !== 'Done' && data.outcomes.find(o => o.id === task.outcomeId)?.complete}<div class="form-warning" role="status">このタスクを保存すると、選択したOutcomeの完了が解除されます。</div>{/if}</div>
      {:else}
        <div class="form-grid"><div class="form-group"><label for="priority" class="form-label">優先度</label><select id="priority" class="form-select" bind:value={outcome.priority}>{#each ['High', 'Medium', 'Low'] as p}<option>{p}</option>{/each}</select></div><div class="form-group"><label class="form-label" for="complete">完了フラグ</label><input id="complete" type="checkbox" bind:checked={outcome.complete} disabled={!canComplete} /><p class="form-hint">{canComplete ? '手動で完了にできます。' : 'Done以外のTaskがあるため完了にできません。'}</p></div></div>
      {/if}
      <div class="divider"></div><h3 class="small-heading">{kind === 'tasks' ? '対応予定期間' : '対応期間'}</h3>
      <div class="form-grid"><div class="form-group"><label for="period-start" class="form-label">開始日</label><DatePicker id="period-start" label="期間開始日" bind:value={startDate} disabled={disabled || busy} /></div><div class="form-group"><label for="period-end" class="form-label">終了日</label><DatePicker id="period-end" label="期間終了日" bind:value={endDate} disabled={disabled || busy} /></div></div>
      <p class="form-hint">{kind === 'tasks' ? '開始日だけならその日以降、終了日だけならその日以前。両方空欄なら期間なし。' : '開始日・終了日の両方を設定するか、両方を空欄にします。'}</p>
      {#if kind === 'tasks' && overflow(candidate, data.outcomes)}<div class="form-warning" role="status">⚠ Outcomeの期間からはみ出しています。保存は可能です。</div>{/if}
      {#if kind === 'tasks'}
        <div class="divider"></div><div class="form-group"><label for="due" class="form-label">締切日</label><DatePicker id="due" label="締切日" bind:value={task.due} disabled={disabled || busy} /></div>
        <div class="form-group"><label for="next-date" class="form-label">次の対応予定（日付）</label><DatePicker id="next-date" label="次の対応予定（日付）" bind:value={nextDate} disabled={disabled || busy} /></div>
        <div class="form-grid"><div class="form-group"><span class="form-label">開始時刻</span><TimePicker bind:value={nextStart} step={data.settings.timeStep} label="開始時刻" disabled={disabled || busy} /></div><div class="form-group"><span class="form-label">終了時刻</span><TimePicker bind:value={nextEnd} step={data.settings.timeStep} label="終了時刻" disabled={disabled || busy} /></div></div>
        <button type="button" class="ghost" onclick={() => { nextDate = ''; nextStart = ''; nextEnd = ''; }}>次の対応予定を解除</button>
      {/if}
      <div class="form-group"><label for="memo" class="form-label">メモ</label><textarea id="memo" class="form-textarea" bind:value={draft.memo}></textarea></div>
    </fieldset>
    {#if message}<div class="form-error" role="alert">{message}</div>{/if}
    {#if kind === 'outcomes'}<div class="summary-box"><strong>紐づくTask {children.length}件</strong>{#each children as t}<p>{t.name} <span class="badge {t.status}">{t.status}</span></p>{/each}</div>{/if}
  </form>
  <div class="drawer-foot">{#if item.id}<button class="link-danger" disabled={disabled || busy} onclick={async () => { if (confirm(kind === 'outcomes' ? 'このOutcomeを削除しますか？ Taskの紐づけのみ解除します。' : 'このTaskを削除しますか？')) { try { await remove(); } catch (e) { message = (e as Error).message; } } }}>削除</button>{/if}<span class="spacer"></span><button class="secondary" disabled={busy} onclick={close}>キャンセル</button><button class="primary" form="detail-form" disabled={disabled || busy}>{busy ? '保存中…' : item.id ? '保存' : '作成'}</button></div>
</dialog>
