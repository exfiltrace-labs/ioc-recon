import type { Source, Encoding, SourceTransform } from './types';
import { refang as doRefang } from './indicators';
import { compileRegex } from './regex';
import { isHttpProtocol } from './url';

export interface BuiltRequest {
  method: 'GET' | 'POST';
  url: string;
  body?: string;
  contentType?: string;
}

export const DEFAULT_PLACEHOLDER = '%s';

function encodeValue(value: string, encoding: Encoding): string {
  switch (encoding) {
    case 'url':
      return encodeURIComponent(value);
    case 'base64':
      return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
    case 'none':
    default:
      return value;
  }
}

export function applyTransforms(value: string, transforms?: SourceTransform[]): string {
  if (!transforms?.length) return value;
  let v = value;
  for (const t of transforms) {
    if (!t?.pattern) continue;
    const re = compileRegex(t.pattern, t.flags ?? 'g');
    if (!re) continue;
    v = v.replace(re, t.replacement ?? '');
  }
  return v;
}

export function prepareValue(
  rawValue: string,
  opts: { encoding?: Encoding; refang?: boolean; transform?: SourceTransform[] },
): string {
  const base = opts.refang ? doRefang(rawValue) : rawValue.trim();
  const transformed = applyTransforms(base, opts.transform);
  return encodeValue(transformed, opts.encoding ?? 'none');
}

export function expandTemplate(
  template: string,
  rawValue: string,
  opts: { placeholder?: string; encoding?: Encoding; refang?: boolean },
): string {
  const placeholder = opts.placeholder || DEFAULT_PLACEHOLDER;
  const prepared = prepareValue(rawValue, opts);
  if (!template.includes(placeholder)) return template;
  return template.split(placeholder).join(prepared);
}

export function buildRequest(
  source: Source,
  rawValue: string,
  placeholder = DEFAULT_PLACEHOLDER,
): BuiltRequest {
  const common = {
    placeholder,
    encoding: source.encoding,
    refang: source.refang,
    transform: source.transform,
  };
  const url = expandTemplate(source.url, rawValue, common);

  const parsed = new URL(url);
  if (!isHttpProtocol(parsed.protocol)) {
    throw new Error(`Refusing to open non-http(s) URL: ${parsed.protocol}`);
  }

  const req: BuiltRequest = { method: source.method, url };
  if (source.method === 'POST') {
    req.body = expandTemplate(source.body ?? '', rawValue, common);
    req.contentType = source.contentType || 'application/x-www-form-urlencoded';
  }
  return req;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function bodyToFields(body: string, contentType: string): Array<[string, string]> {
  const ct = contentType.toLowerCase();
  if (ct.includes('application/json')) {
    try {
      const obj = JSON.parse(body) as Record<string, unknown>;
      return Object.entries(obj).map(([k, v]) => [k, String(v)]);
    } catch {
      return [['__raw_json__', body]];
    }
  }
  return body
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf('=');
      if (idx === -1) return [safeDecode(pair), ''] as [string, string];
      return [safeDecode(pair.slice(0, idx)), safeDecode(pair.slice(idx + 1))] as [string, string];
    });
}
