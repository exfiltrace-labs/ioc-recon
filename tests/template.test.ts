import { describe, it, expect } from 'vitest';
import { prepareValue, expandTemplate, buildRequest, bodyToFields } from '../lib/template';
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

describe('prepareValue', () => {
  it('url-encodes', () => {
    expect(prepareValue('a b/c', { encoding: 'url' })).toBe('a%20b%2Fc');
  });
  it('base64-encodes utf-8 safely', () => {
    expect(prepareValue('hi', { encoding: 'base64' })).toBe('aGk=');
  });
  it('refangs before encoding', () => {
    expect(prepareValue('evil[.]com', { refang: true })).toBe('evil.com');
  });
});

describe('transforms', () => {
  it('applies a transform before encoding', () => {
    expect(
      prepareValue('T1543.003', { transform: [{ pattern: '\\.', replacement: '/' }] }),
    ).toBe('T1543/003');
  });
  it('leaves non-matching values untouched', () => {
    expect(
      prepareValue('T1027', { transform: [{ pattern: '\\.', replacement: '/' }] }),
    ).toBe('T1027');
  });
  it('supports capture-group replacements', () => {
    expect(
      prepareValue('abc123', { transform: [{ pattern: '(\\d+)$', replacement: '#$1' }] }),
    ).toBe('abc#123');
  });
  it('runs rules in order and skips invalid ones', () => {
    expect(
      prepareValue('a.b.c', {
        transform: [
          { pattern: '[', replacement: 'x' },
          { pattern: '\\.', replacement: '-' },
        ],
      }),
    ).toBe('a-b-c');
  });
  it('runs after refang', () => {
    expect(
      prepareValue('evil[.]com', {
        refang: true,
        transform: [{ pattern: '\\.', replacement: '_' }],
      }),
    ).toBe('evil_com');
  });
  it('builds the canonical MITRE sub-technique URL', () => {
    const r = buildRequest(
      src({
        url: 'https://attack.mitre.org/techniques/%s/',
        transform: [{ pattern: '\\.', replacement: '/' }],
      }),
      'T1543.003',
    );
    expect(r.url).toBe('https://attack.mitre.org/techniques/T1543/003/');
  });
});

describe('expandTemplate', () => {
  it('replaces every placeholder occurrence', () => {
    expect(expandTemplate('a/%s/%s', 'x', {})).toBe('a/x/x');
  });
  it('does not re-scan the substituted value', () => {
    expect(expandTemplate('q=%s', '%s', {})).toBe('q=%s');
  });
  it('honours a custom placeholder', () => {
    expect(expandTemplate('q={{ioc}}', 'x', { placeholder: '{{ioc}}' })).toBe('q=x');
  });
});

describe('buildRequest', () => {
  it('expands a GET url', () => {
    const r = buildRequest(src({ url: 'https://e.com/search/%s', encoding: 'url' }), '8.8.8.8');
    expect(r.method).toBe('GET');
    expect(r.url).toBe('https://e.com/search/8.8.8.8');
    expect(r.body).toBeUndefined();
  });

  it('expands a POST body and defaults the content type', () => {
    const r = buildRequest(
      src({ method: 'POST', url: 'https://e.com/', body: 'q=%s' }),
      'x',
    );
    expect(r.method).toBe('POST');
    expect(r.body).toBe('q=x');
    expect(r.contentType).toBe('application/x-www-form-urlencoded');
  });

  it('refuses non-http(s) templates', () => {
    expect(() => buildRequest(src({ url: 'javascript:alert(%s)' }), '1')).toThrow();
    expect(() => buildRequest(src({ url: 'data:text/html,%s' }), '1')).toThrow();
  });
});

describe('bodyToFields', () => {
  it('parses form-urlencoded pairs', () => {
    expect(bodyToFields('a=1&b=2', 'application/x-www-form-urlencoded')).toEqual([
      ['a', '1'],
      ['b', '2'],
    ]);
  });

  it('does not throw on a lone percent sign', () => {
    expect(() => bodyToFields('q=50%', 'application/x-www-form-urlencoded')).not.toThrow();
    expect(bodyToFields('q=50%', 'application/x-www-form-urlencoded')).toEqual([['q', '50%']]);
  });

  it('flattens JSON bodies', () => {
    expect(bodyToFields('{"q":"x","n":2}', 'application/json')).toEqual([
      ['q', 'x'],
      ['n', '2'],
    ]);
  });
});
