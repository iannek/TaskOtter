<script lang="ts">
  let { name, expanded, toggle, disabled = false }: { name: string; expanded: boolean; toggle: () => void; disabled?: boolean } = $props();
</script>
<button type="button" class="outcome-fold" aria-label={`${name}を${expanded ? '折りたたむ' : '展開する'}`} aria-expanded={expanded} title={expanded ? '折りたたむ' : '展開する'} {disabled} onclick={toggle}>{expanded ? '▾' : '▸'}</button>
