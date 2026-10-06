<script lang="ts">
  let { name, add, disabled }: { name: string; add: () => void; disabled: boolean } = $props();
</script>
<div class="task-add-row"><button type="button" class="task-add-action" aria-label={`${name}にTaskを追加`} {disabled} onclick={add}><span aria-hidden="true">＋</span><span>新しいタスクを追加</span></button></div>
