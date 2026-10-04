export type ReferenceTarget = { kind: 'web' | 'local'; href: string };
// Never execute commands or expose a server-side filesystem opener.
export function referenceTarget(value: string): ReferenceTarget | null {
  const text = value.trim();
  if (!text || /[\u0000-\u001f\u007f]/.test(text)) return null;
  if (/^https?:\/\//i.test(text)) {
    try { const url = new URL(text); return url.hostname ? { kind: 'web', href: url.href } : null; } catch { return null; }
  }
  if (/^file:\/\//i.test(text)) {
    try { const url = new URL(text); return url.pathname && url.pathname !== '/' ? { kind: 'local', href: url.href } : null; } catch { return null; }
  }
  const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
  if (/^[a-z]:[\\/]/i.test(text)) return { kind: 'local', href: `file:///${text[0]}:${encodePath(text.slice(2).replace(/\\/g, '/'))}` };
  if (/^\\\\[^\\]+\\/.test(text)) { const path = text.slice(2).replace(/\\/g, '/'); return { kind: 'local', href: `file://${encodePath(path)}` }; }
  if (text.startsWith('/') && !text.startsWith('//')) return { kind: 'local', href: `file://${encodePath(text)}` };
  return null;
}
