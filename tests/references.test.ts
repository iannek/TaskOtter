import { describe, expect, it } from 'vitest';
import { referenceTarget } from '../src/shared/references.js';
describe('reference navigation', () => {
  it.each(['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.example', 'relative/file', 'https://', 'https://example.com\n'])('rejects unsafe or ambiguous destinations: %s', value => {
    // Surrounding whitespace is allowed; embedded control characters are not.
    if (value.endsWith('\n')) value = 'https://exam\nple.com';
    expect(referenceTarget(value)).toBeNull();
  });
  it('encodes local path punctuation instead of treating it as URL query or fragment', () => {
    expect(referenceTarget('C:\\資料 [a]\\file #1?.txt')).toEqual({ kind: 'local', href: 'file:///C:/%E8%B3%87%E6%96%99%20%5Ba%5D/file%20%231%3F.txt' });
    expect(referenceTarget('/home/user/資料 #1')).toEqual({ kind: 'local', href: 'file:///home/user/%E8%B3%87%E6%96%99%20%231' });
    expect(referenceTarget('\\\\server\\share\\file.txt')?.href).toBe('file://server/share/file.txt');
    expect(referenceTarget(' file:///C:/data/file.txt ')?.kind).toBe('local');
    expect(referenceTarget('https://example.com/資料')?.kind).toBe('web');
  });
});
