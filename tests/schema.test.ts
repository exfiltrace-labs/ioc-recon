import { describe, it, expect } from 'vitest';
import {
  normalizeSource,
  validateBundle,
  sourceSignature,
  stripRuntime,
  buildExport,
  defaultLocalConfig,
} from '../lib/schema';
import type { Source } from '../lib/types';

function norm(raw: unknown) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const s = normalizeSource(raw, errors, warnings, 0);
  return { s, errors, warnings };
}

describe('normalizeSource', () => {
  it('rejects entries without name or url', () => {
    expect(norm({ url: 'https://e.com/%s' }).s).toBeNull();
    expect(norm({ name: 'x' }).s).toBeNull();
  });

  it('applies defaults', () => {
    const { s } = norm({ name: 'X', url: 'https://e.com/%s' });
    expect(s?.method).toBe('GET');
    expect(s?.encoding).toBe('none');
    expect(s?.refang).toBe(true);
    expect(s?.types).toEqual(['any']);
    expect(s?.enabled).toBe(true);
  });

  it('derives a stable content-based id when none is given', () => {
    const a = norm({ name: 'X', url: 'https://e.com/%s' }).s!;
    const b = norm({ name: 'X', url: 'https://e.com/%s' }).s!;
    expect(a.id).toBe(b.id);
    expect(a.id.startsWith('gen-')).toBe(true);
  });

  it('gives different content a different derived id', () => {
    const a = norm({ name: 'X', url: 'https://e.com/a/%s' }).s!;
    const b = norm({ name: 'X', url: 'https://e.com/b/%s' }).s!;
    expect(a.id).not.toBe(b.id);
  });

  it('keeps an explicit id', () => {
    expect(norm({ id: 'keep-me', name: 'X', url: 'https://e.com/%s' }).s?.id).toBe('keep-me');
  });

  it('warns when the template lacks a placeholder', () => {
    expect(norm({ name: 'X', url: 'https://e.com/' }).warnings.length).toBeGreaterThan(0);
  });

  it('keeps valid match and transform rules', () => {
    const { s } = norm({
      name: 'X',
      url: 'https://e.com/%s',
      match: { pattern: '^T\\d{4}', flags: 'i' },
      transform: [{ pattern: '\\.', replacement: '/' }, { pattern: 'a', replacement: 'b', flags: 'gi' }],
    });
    expect(s?.match).toEqual({ pattern: '^T\\d{4}', flags: 'i' });
    expect(s?.transform).toEqual([
      { pattern: '\\.', replacement: '/' },
      { pattern: 'a', replacement: 'b', flags: 'gi' },
    ]);
  });

  it('drops invalid regexes with a warning', () => {
    const bad = norm({
      name: 'X',
      url: 'https://e.com/%s',
      match: { pattern: '[' },
      transform: [{ pattern: '(', replacement: 'x' }],
    });
    expect(bad.s?.match).toBeUndefined();
    expect(bad.s?.transform).toBeUndefined();
    expect(bad.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('accepts a single transform object and defaults a missing replacement', () => {
    const { s } = norm({
      name: 'X',
      url: 'https://e.com/%s',
      transform: { pattern: '\\s+' },
    });
    expect(s?.transform).toEqual([{ pattern: '\\s+', replacement: '' }]);
  });
});

describe('validateBundle', () => {
  it('fails on non-object or missing sources', () => {
    expect(validateBundle(null).ok).toBe(false);
    expect(validateBundle({}).ok).toBe(false);
  });

  it('reassigns duplicate explicit ids', () => {
    const res = validateBundle({
      sources: [
        { id: 'dup', name: 'A', url: 'https://e.com/a/%s' },
        { id: 'dup', name: 'B', url: 'https://e.com/b/%s' },
      ],
    });
    expect(res.ok).toBe(true);
    const ids = res.value!.sources.map((s) => s.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('picks up known settings only', () => {
    const res = validateBundle({
      sources: [{ name: 'A', url: 'https://e.com/%s' }],
      settings: { placeholder: '@@', showAllItem: false, bogus: 1 },
    });
    expect(res.value!.settings).toEqual({ placeholder: '@@', showAllItem: false });
  });
});

describe('sourceSignature', () => {
  it('ignores id, origin and enabled', () => {
    const base: Source = {
      id: '1', name: 'A', method: 'GET', url: 'https://e.com/%s',
      encoding: 'url', refang: true, types: ['ipv4'], enabled: true,
    };
    const other: Source = { ...base, id: '2', enabled: false, origin: 'remote' };
    expect(sourceSignature(base)).toBe(sourceSignature(other));
  });

  it('changes when a meaningful field changes', () => {
    const base: Source = {
      id: '1', name: 'A', method: 'GET', url: 'https://e.com/%s',
      encoding: 'url', refang: true, types: ['ipv4'], enabled: true,
    };
    expect(sourceSignature(base)).not.toBe(sourceSignature({ ...base, url: 'https://e.com/x/%s' }));
  });

  it('is order-independent for types', () => {
    const a: Source = {
      id: '1', name: 'A', method: 'GET', url: 'https://e.com/%s',
      encoding: 'url', refang: true, types: ['ipv4', 'domain'], enabled: true,
    };
    expect(sourceSignature(a)).toBe(sourceSignature({ ...a, types: ['domain', 'ipv4'] }));
  });
});

describe('stripRuntime / buildExport', () => {
  it('drops the runtime origin field', () => {
    const s: Source = {
      id: '1', name: 'A', method: 'GET', url: 'https://e.com/%s',
      encoding: 'url', refang: true, types: ['any'], enabled: true, origin: 'local',
    };
    expect('origin' in stripRuntime(s)).toBe(false);
  });

  it('exports a round-trippable bundle', () => {
    const cfg = defaultLocalConfig();
    const bundle = buildExport(cfg.sources, cfg.settings, '2026-01-01T00:00:00.000Z');
    const res = validateBundle(bundle);
    expect(res.ok).toBe(true);
    expect(res.value!.sources.length).toBe(cfg.sources.length);
  });
});
