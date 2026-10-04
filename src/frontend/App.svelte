<script lang="ts">
import { onMount } from 'svelte';
import { api } from './api.js';
import DatePicker from './components/DatePicker.svelte';
import Editor from './components/Editor.svelte';
import TaskRow from './components/TaskRow.svelte';
import TaskTableRow from './components/TaskTableRow.svelte';
import Gantt from './components/Gantt.svelte';
import Calendar from './components/Calendar.svelte';
import { emptyData, localDate, inRange, overflow, newTask, newOutcome, rangeText, statuses, type Data, type Task, type Outcome } from '../shared/model.js';
let data = $state<Data>(emptyData()), loading = $state(true), error = $state(''), blocked = $state(false), busy = $state(false), toast = $state('');
let view = $state('dashboard'), tab = $state('list'), quickName = $state(''), search = $state(''), status = $state('all'), category = $state('all'), nextFrom = $state(''), nextTo = $state('');
let sidebarWidth = $state(470), showDone = $state(false);
let editor = $state<{ kind: 'tasks' | 'outcomes'; item: Task | Outcome } | null>(null);
const nav = [['dashboard', '◫', 'ダッシュボード'], ['tasks', '☷', 'Task・Outcome'], ['gantt', '▥', 'ガントチャート'], ['calendar', '▦', 'カレンダー']];
let disabled = $derived(blocked || loading || busy);
let categories = $derived([...new Set(data.tasks.map(t => t.category).filter(Boolean))]);
let filtered = $derived(data.tasks.filter(t => (showDone || status === 'Done' || t.status !== 'Done') && (status === 'all' || t.status === status) && (category === 'all' || t.category === category) && (!search || t.name.toLowerCase().includes(search.toLowerCase()))));
let groups = $derived([...data.outcomes.map(o => ({ o: o as Outcome | null, children: filtered.filter(t => t.outcomeId === o.id) })).filter(g => g.children.length || (!g.o!.complete && !search)), { o: null, children: filtered.filter(t => !t.outcomeId) }]);
let active = $derived(data.tasks.filter(t => inRange(t, localDate())));
let scheduled = $derived(data.tasks.filter(t => t.next && t.status !== 'Done' && (!nextFrom || t.next.slice(0, 10) >= nextFrom) && (!nextTo || t.next.slice(0, 10) <= nextTo)).sort((a, b) => a.next.localeCompare(b.next)));
let toastTimer: ReturnType<typeof setTimeout>;
function notify(message: string) { toast = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast = '', 2800); }
async function load() {
  loading = true; editor = null;
  try { data = await api(); error = ''; blocked = false; } catch (e) { error = (e as Error).message; blocked = true; }
  finally { loading = false; }
}
onMount(() => { void load(); return () => clearTimeout(toastTimer); });
function openTask(item: Task) { if (!disabled) editor = { kind: 'tasks', item }; }
function addTask(outcomeId = '') { openTask({ ...newTask(), outcomeId }); }
function openOutcome(item: Outcome) { if (!disabled) editor = { kind: 'outcomes', item }; }
async function mutate(path: string, method: string, value?: unknown) {
  if (disabled) return;
  busy = true;
  try { data = await api(path, method, value); error = ''; }
  catch (e) {
    error = (e as Error).message;
    // A malformed disk file locks every form. A normal input rejection does not.
    try { await api(); } catch (diskError) { blocked = true; error = (diskError as Error).message; }
    throw e;
  } finally { busy = false; }
}
async function save(item: Task | Outcome, newOutcomeName?: string) { if (!editor) return; const kind = editor.kind; const combined = kind === 'tasks' && newOutcomeName; await mutate(combined ? `/api/tasks/with-outcome${item.id ? '/' + encodeURIComponent(item.id) : ''}` : `/api/${kind}${item.id ? '/' + encodeURIComponent(item.id) : ''}`, item.id ? 'PUT' : 'POST', combined ? { task: item, newOutcomeName } : item); editor = null; notify('保存しました'); }
async function saveInline(task: Task) { await mutate(`/api/tasks/${encodeURIComponent(task.id)}`, 'PUT', task); notify('保存しました'); }
async function remove() { if (!editor) return; await mutate(`/api/${editor.kind}/${encodeURIComponent(editor.item.id)}`, 'DELETE'); editor = null; notify('削除しました'); }
async function quickAdd(e: SubmitEvent) { e.preventDefault(); if (!quickName.trim()) return; try { await mutate('/api/tasks', 'POST', newTask(quickName.trim(), 'pending')); quickName = ''; notify('Inboxに追加しました'); } catch {} }
async function setStep(event: Event) { try { await mutate('/api/settings', 'PUT', { timeStep: Number((event.target as HTMLSelectElement).value) }); notify('設定を保存しました'); } catch {} }
</script>
<div class="app">
  <aside class="sidebar"><div class="brand"><span class="brand-logo"><img src="/taskotter-logo.png" alt="TaskOtter" /></span></div><div class="side-label">WORKSPACE</div><nav>{#each nav as [v, icon, label]}<button class="nav-btn" aria-label={label} class:active={view === v} onclick={() => { view = v; editor = null; }}><span class="nav-icon">{icon}</span><span class="nav-text">{label}</span></button>{/each}</nav><div class="sidebar-bottom"><strong>ローカルワークスペース</strong><small>変更はJSONに保存されます。<br>外部の更新は再読み込みで反映。</small><label for="time-step">時刻の選択間隔</label><select id="time-step" class="field" disabled={disabled} onchange={setStep}><option value="15" selected={data.settings.timeStep === 15}>15分</option><option value="30" selected={data.settings.timeStep === 30}>30分</option></select></div></aside>
  <main class="main"><header class="topbar"><div class="breadcrumb">Workspace / <strong>{nav.find(n => n[0] === view)?.[2]}</strong></div><span class="top-note">LOCAL · JSON</span><button class="secondary" disabled={busy || loading} onclick={load}>再読み込み</button></header>
    <div class="content">
      {#if error}<div class="prototype-banner error-state" role="alert"><strong>{blocked ? 'JSONを読み込めません。編集・保存は無効です。' : '操作を完了できませんでした。'}</strong><pre>{error}</pre><span>ファイルを確認・修正し、再読み込みしてください。</span></div>{/if}
      {#if loading}<div class="empty" role="status">読み込み中…</div>{:else}
      <div class="page-head"><div><div class="eyebrow">{view === 'dashboard' ? 'OVERVIEW' : view === 'gantt' ? 'TIMELINE' : 'WORKSPACE'}</div><h1 class="page-title">{nav.find(n => n[0] === view)?.[2]}</h1><p class="page-subtitle">{view === 'dashboard' ? '今動いているTaskと、次の対応予定を確認します。' : view === 'tasks' ? 'Outcomeを親にした一覧と、Outcomeカードを切り替えます。' : view === 'gantt' ? 'OutcomeとTaskの独立した期間を確認します。' : '締切と、実際に取り組む時間を確認します。'}</p></div><div class="page-actions"><button class="secondary" disabled={disabled} onclick={() => openOutcome(newOutcome())}>＋ Outcome</button><button class="primary" disabled={disabled} onclick={() => addTask()}>＋ Task</button></div></div>
      {#if view === 'dashboard' || view === 'tasks'}<form class="quick-add" onsubmit={quickAdd}><span>＋</span><input name="name" aria-label="Taskをすばやく追加" placeholder="思いついたTaskを名前だけでInboxへ追加" bind:value={quickName} disabled={disabled} /><button class="primary" disabled={disabled || !quickName.trim()}>追加</button></form>{/if}
      {#if view === 'dashboard'}
        <div class="cards">{#each [['残タスク', data.tasks.filter(t => !['Someday', 'Done'].includes(t.status)).length, 'Someday・Doneを除く'], ['対応予定期間中', active.length, '今日の作業対象'], ['完了Task', data.tasks.filter(t => t.status === 'Done').length, 'ステータスがDone']] as [label, count, foot]}<div class="metric"><div class="metric-label">{label}</div><div class="metric-number">{count}</div><div class="metric-foot">{foot}</div></div>{/each}</div>
        <div class="grid-2"><section class="panel"><div class="panel-header"><div><h2 class="panel-title">次の対応予定</h2><p class="panel-caption">過去の予定も表示 · 古い順</p></div><span class="pill">{scheduled.length} 件</span></div><div class="panel-body"><div class="toolbar" style="margin-top:12px"><DatePicker label="予定の絞り込み開始日" bind:value={nextFrom} /><span>〜</span><DatePicker label="予定の絞り込み終了日" bind:value={nextTo} /><button class="ghost" onclick={() => { nextFrom = ''; nextTo = ''; }}>解除</button></div>{#each scheduled as t}<TaskRow task={t} outcomes={data.outcomes} open={openTask} save={saveInline} {disabled} end="next" />{:else}<div class="empty">次の対応予定はありません。</div>{/each}</div></section><section class="panel"><div class="panel-header"><div><h2 class="panel-title">対応予定期間中</h2><p class="panel-caption">今日が期間に含まれるTask</p></div><span class="pill">{active.length} 件</span></div><div class="panel-body">{#each active as t}<TaskRow task={t} outcomes={data.outcomes} open={openTask} save={saveInline} {disabled} end="range" />{:else}<div class="empty">期間中のTaskはありません。</div>{/each}</div></section></div>
      {:else if view === 'tasks'}
        <div class="view-tabs" role="tablist" aria-label="表示形式"><button class="view-tab" class:active={tab === 'list'} role="tab" aria-selected={tab === 'list'} onclick={() => tab = 'list'}>階層一覧</button><button class="view-tab" class:active={tab === 'cards'} role="tab" aria-selected={tab === 'cards'} onclick={() => tab = 'cards'}>Outcomeカード</button></div>
        <label class="selection-info done-toggle"><input type="checkbox" bind:checked={showDone} /> Doneも表示</label>
        {#if tab === 'list'}
        <div class="toolbar"><input class="search" aria-label="Task名を検索" placeholder="Task名を検索" bind:value={search} /><select class="field" aria-label="Taskのステータス" bind:value={status}><option value="all">全ステータス</option>{#each statuses as s}<option>{s}</option>{/each}</select><select class="field" aria-label="Taskのカテゴリ" bind:value={category}><option value="all">全カテゴリ</option>{#each categories as c}<option>{c}</option>{/each}</select><span class="spacer"></span><span class="selection-info">Task {filtered.length}件</span></div>
        <section class="panel table-wrap"><table class="table task-list-table"><colgroup><col class="name-col" /><col class="status-col" /><col class="category-col" /><col class="range-col" /><col class="due-col" /><col class="next-col" /><col /></colgroup><thead><tr><th>Outcome / Task</th><th>ステータス</th><th>カテゴリ</th><th>対応予定期間</th><th>締切日</th><th>次の対応予定</th><th aria-label="余白"></th></tr></thead><tbody>{#each groups as g}
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (親行の空白とキーボードから詳細を開く) -->
<tr class="group-row" class:clickable={!!g.o} tabindex={g.o ? 0 : undefined} aria-label={g.o ? `${g.o.name}の詳細` : undefined} onclick={(event) => { if (g.o && !(event.target as HTMLElement).closest('button,input')) openOutcome(g.o); }} onkeydown={(event) => { if (g.o && event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); openOutcome(g.o); } }}>
  <td><div class="group-cell">{#if g.o}<button class="group-add" disabled={disabled} aria-label={`${g.o.name}にTaskを追加`} title="このOutcomeにTaskを追加" onclick={() => addTask(g.o!.id)}>＋</button><button class="group-title two-line-title" title={g.o.name} onclick={() => openOutcome(g.o!)}>{g.o.name}</button>{:else}<span class="group-add-placeholder"></span><span class="group-title">Outcomeなし</span>{/if}</div></td>
  <td>{#if g.o?.complete}<span class="badge Done">完了</span>{/if}</td><td></td><td class="group-period"><span class="group-meta">{g.o ? rangeText(g.o) : '-'}</span></td><td></td><td></td><td></td>
</tr>
{#each g.children as t (t.id)}<TaskTableRow task={t} outcomes={data.outcomes} timeStep={data.settings.timeStep} {disabled} open={openTask} save={saveInline} />{/each}{/each}</tbody></table></section>
        {:else}<div class="outcome-grid">{#each data.outcomes as o}{@const children = data.tasks.filter(t => t.outcomeId === o.id)}{@const done = children.filter(t => t.status === 'Done').length}<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (カード内のTask操作を除き、カード全体からOutcome詳細を開く) -->
<article class="panel outcome-card" tabindex="0" aria-label={`${o.name}の詳細`} onclick={(e) => { if (!(e.target as HTMLElement).closest('button,input,select,textarea,a')) openOutcome(o); }} onkeydown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openOutcome(o); } }}><div class="outcome-top"><button class="group-add" disabled={disabled} aria-label={`${o.name}にTaskを追加`} onclick={() => addTask(o.id)}>＋</button><div class="outcome-card-title"><h2 class="outcome-name"><button class="group-title" onclick={() => openOutcome(o)}>{o.name}</button></h2><div class="outcome-meta">{rangeText(o)}</div></div><div class="outcome-card-actions">{#if o.complete}<span class="badge Done">完了</span>{/if}</div></div><div class="progress-line"><span style={`width:${children.length ? done / children.length * 100 : 0}%`}></span></div><div class="outcome-footer"><span>Task {done} / {children.length} Done</span><button class="ghost" onclick={() => openOutcome(o)}>詳細を見る →</button></div>{#each children.filter(t => showDone || t.status !== 'Done') as t}<TaskRow task={t} outcomes={data.outcomes} open={openTask} save={saveInline} {disabled} />{:else}<p class="selection-info">{children.length ? '表示対象のTaskなし（Doneは非表示）' : '紐づくTaskなし'}</p>{/each}</article>{/each}<article class="panel outcome-card unassigned-card"><h2 class="outcome-name">Outcomeなし</h2>{#each data.tasks.filter(task => !task.outcomeId && (showDone || task.status !== 'Done')) as task}<TaskRow {task} outcomes={data.outcomes} open={openTask} save={saveInline} {disabled} />{:else}<p class="selection-info">紐づく表示対象のTaskなし</p>{/each}</article></div>{/if}
      {:else if view === 'gantt'}<Gantt {data} {openTask} {openOutcome} {addTask} {disabled} save={saveInline} />
      {:else if view === 'calendar'}<Calendar tasks={data.tasks} open={openTask} save={saveInline} {disabled} />{/if}
      {/if}
    </div>
  </main><nav class="nav-mobile">{#each nav as [v, icon, label]}<button aria-label={label} class:active={view === v} onclick={() => { view = v; editor = null; }}><span>{icon}</span>{label}</button>{/each}</nav>
  {#if editor}{#key `${editor.kind}:${editor.item.id}`}<Editor bind:width={sidebarWidth} kind={editor.kind} item={editor.item} {data} {busy} disabled={blocked} {save} {remove} close={() => editor = null} />{/key}{/if}
  {#if toast}<div class="toast" role="status">{toast}</div>{/if}
</div>
