<script lang="ts">
  import { Marked } from 'marked';
  import DOMPurify from 'dompurify';
  let { value = $bindable(''), disabled = false }: { value: string; disabled?: boolean } = $props();
  let preview = $state(false);
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const markdown = new Marked({ gfm: true, breaks: true, renderer: {
    html({ text }) { return escape(text); },
    // Images remain text: previewing a note must not request remote resources.
    image({ text }) { return escape(text); },
    link({ href, title, tokens }) {
      const content = this.parser.parseInline(tokens);
      let url: URL; try { url = new URL(href); } catch { return content; }
      if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return content;
      return `<a href="${escape(url.href)}"${title ? ` title="${escape(title)}"` : ''} target="_blank" rel="noopener noreferrer">${content}</a>`;
    },
  } });
  let html = $derived(preview ? DOMPurify.sanitize(markdown.parse(value, { async: false }), {
    ALLOWED_TAGS: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'del', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'type', 'checked', 'disabled', 'start', 'align'],
    ALLOW_DATA_ATTR: false,
  }) : '');
</script>
<div class="section-heading"><h3>メモ</h3><span class="badge">Markdown</span></div>
<div class="memo-modes" aria-label="メモの表示"><button type="button" class:active={!preview} aria-pressed={!preview} onclick={() => preview = false}>編集</button><button type="button" class:active={preview} aria-pressed={preview} onclick={() => preview = true}>プレビュー</button></div>
{#if preview}<div class="markdown-body">{@html html}</div>{#if !value}<p class="empty">メモはまだありません。</p>{/if}
{:else}<label for="memo" class="form-label">メモ</label><textarea id="memo" class="form-textarea markdown-input" bind:value {disabled} placeholder="# 見出し&#10;&#10;メモをMarkdownで記載"></textarea>{/if}
