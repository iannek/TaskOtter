<script lang="ts">
  let { label, options, values = $bindable<string[]>([]), mode = $bindable<'include' | 'exclude'>('include') }: { label: string; options: string[]; values?: string[]; mode?: 'include' | 'exclude' } = $props();
  let menu: HTMLDetailsElement;
</script>
<svelte:window onpointerdown={(event) => { if (menu.open && !menu.contains(event.target as Node)) menu.open = false; }} onkeydown={(event) => { if (event.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary')?.focus(); } }} />
<details bind:this={menu} class="task-filter">
  <summary>{label}：{values.length ? `${values.map(value => value || 'カテゴリなし').join('・')} ${mode === 'exclude' ? '以外' : ''}` : 'すべて'}</summary>
  <div class="task-filter-options">
    <select class="field" aria-label={`${label}の検索条件`} bind:value={mode}><option value="include">選択を含む（OR）</option><option value="exclude">選択を除く（NOT）</option></select>
    {#each options as value}<label><input type="checkbox" bind:group={values} {value} />{value || 'カテゴリなし'}</label>{/each}
    <button class="ghost" onclick={() => values = []}>選択を解除</button>
  </div>
</details>
