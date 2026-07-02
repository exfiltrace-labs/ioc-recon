import { describe, it, expect } from 'vitest';
import {
  refang,
  defang,
  detect,
  detectTypes,
  sourceMatches,
  selectionMatchesSource,
} from '../lib/indicators';
import type { Source } from '../lib/types';

function src(partial: Partial<Source>): Source {
  return {
    id: 'x',
    name: 'S',
    method: 'GET',
    url: 'https://e.com/%s',
    encoding: 'none',
    refang: false,
    types: ['any'],
    enabled: true,
    ...partial,
  };
}

describe('refang', () => {
  it('restores common defang conventions', () => {
    expect(refang('hxxp://evil[.]com')).toBe('http://evil.com');
    expect(refang('hxxps://a[.]b[.]com/x')).toBe('https://a.b.com/x');
    expect(refang('8[.]8[.]8[.]8')).toBe('8.8.8.8');
    expect(refang('user[at]bad[.]com')).toBe('user@bad.com');
    expect(refang('evil (dot) com')).toBe('evil.com');
  });

  it('strips wrapping quotes/brackets and whitespace', () => {
    expect(refang('  <evil.com>  ')).toBe('evil.com');
    expect(refang('"1.2.3.4"')).toBe('1.2.3.4');
  });
});

describe('defang', () => {
  it('produces non-clickable output', () => {
    expect(defang('http://evil.com')).toBe('hxxp://evil[.]com');
    expect(defang('https://a.b.com')).toBe('hxxps://a[.]b[.]com');
    expect(defang('user@bad.com')).toBe('user@bad[.]com'.replace('@', '[@]'));
  });

  it('round-trips back through refang', () => {
    for (const v of ['http://evil.com', 'https://a.b.com/p', '8.8.8.8']) {
      expect(refang(defang(v))).toBe(v);
    }
  });
});

describe('detectTypes', () => {
  it('classifies each indicator kind', () => {
    expect(detectTypes('8.8.8.8')).toContain('ipv4');
    expect(detectTypes('2001:4860:4860::8888')).toContain('ipv6');
    expect(detectTypes('example.com')).toContain('domain');
    expect(detectTypes('https://example.com/p')).toContain('url');
    expect(detectTypes('user@example.com')).toContain('email');
    expect(detectTypes('d41d8cd98f00b204e9800998ecf8427e')).toContain('md5');
    expect(detectTypes('da39a3ee5e6b4b0d3255bfef95601890afd80709')).toContain('sha1');
    expect(
      detectTypes('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'),
    ).toContain('sha256');
    expect(detectTypes('CVE-2024-3094')).toContain('cve');
  });

  it('does not classify a bare IP or URL as a domain', () => {
    expect(detectTypes('8.8.8.8')).not.toContain('domain');
    expect(detectTypes('https://example.com')).not.toContain('domain');
  });

  it('returns empty for junk', () => {
    expect(detectTypes('not an indicator!!')).toEqual([]);
    expect(detectTypes('')).toEqual([]);
  });
});

describe('detect', () => {
  it('refangs before detecting', () => {
    const d = detect('hxxp://evil[.]com');
    expect(d.refanged).toBe('http://evil.com');
    expect(d.types).toContain('url');
  });
});

describe('sourceMatches', () => {
  it('any-typed sources always match', () => {
    expect(sourceMatches(['any'], [])).toBe(true);
    expect(sourceMatches(['any'], ['ipv4'])).toBe(true);
  });

  it('matches on type intersection', () => {
    expect(sourceMatches(['ipv4', 'domain'], ['domain'])).toBe(true);
    expect(sourceMatches(['ipv4'], ['domain'])).toBe(false);
  });
});

describe('selectionMatchesSource', () => {
  const mitre = src({
    types: ['any'],
    match: { pattern: '^T\\d{4}(\\.\\d{3})?$', flags: 'i' },
  });

  it('gates an any-typed source by its match regex', () => {
    expect(selectionMatchesSource(mitre, detect('T1027'))).toBe(true);
    expect(selectionMatchesSource(mitre, detect('T1543.003'))).toBe(true);
    expect(selectionMatchesSource(mitre, detect('example.com'))).toBe(false);
  });

  it('still requires the type check to pass', () => {
    const s = src({ types: ['ipv4'], match: { pattern: '.*' } });
    expect(selectionMatchesSource(s, detect('example.com'))).toBe(false);
    expect(selectionMatchesSource(s, detect('8.8.8.8'))).toBe(true);
  });

  it('ignores an invalid match regex rather than hiding the source', () => {
    const s = src({ types: ['any'], match: { pattern: '[' } });
    expect(selectionMatchesSource(s, detect('anything'))).toBe(true);
  });

  it('tests the refanged form of the selection', () => {
    const s = src({ types: ['any'], match: { pattern: '^https://' } });
    expect(selectionMatchesSource(s, detect('hxxps://evil[.]com'))).toBe(true);
  });
});
