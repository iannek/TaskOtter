<script lang="ts">
  import type { Task } from '../../shared/model.js';
  let { task }: { task: Task } = $props();
</script>
<div class="task-detail-counts">資料 {task.materials?.length || 0} · チャット {task.chats?.length || 0} · サブタスク {task.subtasks?.filter(row => row.complete).length || 0}/{task.subtasks?.length || 0}</div>
