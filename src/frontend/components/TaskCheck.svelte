<script lang="ts">
  import type { Task } from '../../shared/model.js';
  let { task, disabled = false, save }: { task: Task; disabled?: boolean; save: (task: Task) => Promise<void> } = $props();
  let saving = $state(false), message = $state('');
  async function toggle(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (disabled || saving) { input.checked = task.status === 'Done'; return; }
    const status = input.checked ? 'Done' : task.previousStatus || 'Inbox';
    saving = true; message = '';
    try { await save({ ...task, status }); } catch (error) { message = (error as Error).message; }
    finally { saving = false; input.checked = task.status === 'Done'; }
  }
</script>
<input class="task-done-check" type="checkbox" checked={task.status === 'Done'} aria-label={`${task.name}の完了`} disabled={disabled || saving} onchange={toggle} />
{#if message}<span class="form-error" role="alert">{message}</span>{/if}
