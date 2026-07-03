import type {
  Source,
  Settings,
  RemoteSettings,
  LocalConfig,
  ConfigBundle,
  ValidationResult,
  Encoding,
  HttpMethod,
  IndicatorType,
  SourceMatch,
  SourceTransform,
} from './types';
import { ALL_INDICATOR_TYPES } from './indicators';
import { regexError } from './regex';

export const CONFIG_VERSION = 1;

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'src-' + Math.abs(hashString(String(performance.now()) + Math.random())).toString(36);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

export const DEFAULT_SETTINGS: Settings = {
  placeholder: '%s',
  groupByCategory: true,
  openMultipleInBackground: true,
  showAllItem: true,
};

export const DEFAULT_REMOTE: RemoteSettings = {
  url: '',
  lastSync: 0,
  lastEtag: '',
  lastStatus: '',
  lastError: '',
};

export const SEED_SOURCES: Source[] = [
  {
    id: 'seed-google', name: 'Google', category: 'General', method: 'GET',
    url: 'https://www.google.com/search?q=%s', encoding: 'url', refang: false,
    types: ['any'], enabled: true,
  },
  {
    id: 'seed-vt', name: 'VirusTotal Search', category: 'Threat Intel', method: 'GET',
    url: 'https://www.virustotal.com/gui/search/%s', encoding: 'url', refang: true,
    types: ['ipv4', 'ipv6', 'domain', 'md5', 'sha1', 'sha256'], enabled: true,
  },
  {
    id: 'seed-shodan', name: 'Shodan', category: 'Threat Intel', method: 'GET',
    url: 'https://www.shodan.io/search?query=%s', encoding: 'url', refang: true,
    types: ['ipv4', 'ipv6', 'domain'], enabled: true,
  },
  {
    id: 'seed-abuseipdb', name: 'AbuseIPDB', category: 'Threat Intel', method: 'GET',
    url: 'https://www.abuseipdb.com/check/%s', encoding: 'url', refang: true,
    types: ['ipv4', 'ipv6'], enabled: true,
  },
  {
    id: 'seed-urlscan', name: 'UrlScan.io', category: 'Threat Intel', method: 'GET',
    url: 'https://urlscan.io/search/#%s', encoding: 'url', refang: true,
    types: ['domain', 'ipv4', 'asn'], enabled: true,
  },
  {
    id: 'seed-bgp-he', name: 'Hurricane Electric BGP', category: 'Network', method: 'GET',
    url: 'https://bgp.he.net/%s', encoding: 'url', refang: false,
    types: ['asn'], enabled: true,
  },
  {
    id: 'seed-ipinfo', name: 'IPinfo', category: 'Network', method: 'GET',
    url: 'https://ipinfo.io/%s', encoding: 'url', refang: true,
    types: ['asn', 'ipv4', 'ipv6'], enabled: true,
  },
  {
    id: 'seed-maclookup', name: 'MAC Lookup', category: 'Network', method: 'GET',
    url: 'https://maclookup.app/search/result?mac=%s', encoding: 'none', refang: false,
    types: ['mac'], enabled: true,
    transform: [
      { pattern: '[:.-]', replacement: '', flags: 'g' },
      { pattern: '(..)(?=.)', replacement: '$1:', flags: 'g' },
    ],
  },
  {
    id: 'seed-mitre', name: 'MITRE ATT&CK', category: 'Threat Intel', method: 'GET',
    url: 'https://attack.mitre.org/techniques/%s/', encoding: 'none', refang: false,
    types: ['any'], enabled: true,
    match: { pattern: '^T\\d{4}(\\.\\d{3})?$', flags: 'i' },
    transform: [{ pattern: '\\.', replacement: '/' }],
  },
  {
    id: 'seed-mxtoolbox', name: 'MXToolbox', category: 'Network', method: 'GET',
    url: 'https://mxtoolbox.com/SuperTool.aspx?action=mx%3a%s&run=toolpage', encoding: 'url',
    refang: true, types: ['domain'], enabled: true,
  },
  {
    id: 'seed-whois', name: 'WHOIS (Domain)', category: 'Network', method: 'GET',
    url: 'https://who.is/whois/%s', encoding: 'url', refang: true,
    types: ['domain'], enabled: true,
  },
  {
    id: 'seed-whois-ip', name: 'WHOIS (IP)', category: 'Network', method: 'GET',
    url: 'https://who.is/whois-ip/ip-address/%s', encoding: 'url', refang: true,
    types: ['ipv4'], enabled: true,
  },
  {
    id: 'seed-nvd', name: 'NVD (CVE)', category: 'Vuln', method: 'GET',
    url: 'https://nvd.nist.gov/vuln/detail/%s', encoding: 'url', refang: false,
    types: ['cve'], enabled: true,
  },
];

export function defaultLocalConfig(): LocalConfig {
  return {
    version: CONFIG_VERSION,
    sources: SEED_SOURCES.map((s) => ({ ...s })),
    settings: { ...DEFAULT_SETTINGS },
    overrides: {},
    remote: { ...DEFAULT_REMOTE },
  };
}

const METHODS: HttpMethod[] = ['GET', 'POST'];
const ENCODINGS: Encoding[] = ['none', 'url', 'base64'];

export function normalizeSource(
  raw: unknown,
  errors: string[],
  warnings: string[],
  index: number,
): Source | null {
  if (typeof raw !== 'object' || raw === null) {
    errors.push(`Source #${index + 1} is not an object.`);
    return null;
  }
  const o = raw as Record<string, unknown>;
  const where = `Source #${index + 1}${typeof o.name === 'string' ? ` ("${o.name}")` : ''}`;

  const name = typeof o.name === 'string' ? o.name.trim() : '';
  if (!name) {
    errors.push(`${where}: missing "name".`);
    return null;
  }
  const url = typeof o.url === 'string' ? o.url.trim() : '';
  if (!url) {
    errors.push(`${where}: missing "url".`);
    return null;
  }

  const method: HttpMethod =
    typeof o.method === 'string' && METHODS.includes(o.method.toUpperCase() as HttpMethod)
      ? (o.method.toUpperCase() as HttpMethod)
      : 'GET';

  const encoding: Encoding =
    typeof o.encoding === 'string' && ENCODINGS.includes(o.encoding as Encoding)
      ? (o.encoding as Encoding)
      : 'none';

  let types: IndicatorType[] = ['any'];
  if (Array.isArray(o.types)) {
    const valid = o.types.filter(
      (t): t is IndicatorType => typeof t === 'string' && ALL_INDICATOR_TYPES.includes(t as IndicatorType),
    );
    if (valid.length) types = valid;
    else warnings.push(`${where}: no valid indicator types, defaulting to "any".`);
  }

  if (!url.includes('%s') && !(typeof o.body === 'string' && o.body.includes('%s'))) {
    warnings.push(`${where}: template has no "%s" placeholder; the selection won't be inserted.`);
  }

  const source: Source = {
    id: typeof o.id === 'string' && o.id ? o.id : '',
    name,
    category: typeof o.category === 'string' ? o.category.trim() || undefined : undefined,
    method,
    url,
    encoding,
    refang: o.refang !== false,
    types,
    enabled: o.enabled !== false,
  };
  if (method === 'POST') {
    source.body = typeof o.body === 'string' ? o.body : '';
    source.contentType =
      typeof o.contentType === 'string' && o.contentType
        ? o.contentType
        : 'application/x-www-form-urlencoded';
  }
  if (o.openInBackground === true) source.openInBackground = true;

  const match = normalizeMatch(o.match, where, warnings);
  if (match) source.match = match;
  const transform = normalizeTransforms(o.transform, where, warnings);
  if (transform.length) source.transform = transform;

  if (!source.id) source.id = 'gen-' + Math.abs(hashString(sourceSignature(source))).toString(36);
  return source;
}

function normalizeMatch(
  raw: unknown,
  where: string,
  warnings: string[],
): SourceMatch | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'object') {
    warnings.push(`${where}: "match" must be an object; ignoring.`);
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const pattern = typeof o.pattern === 'string' ? o.pattern : '';
  if (!pattern) return undefined;
  const flags = typeof o.flags === 'string' && o.flags ? o.flags : undefined;
  const err = regexError(pattern, flags);
  if (err) {
    warnings.push(`${where}: match pattern ignored. ${err}`);
    return undefined;
  }
  return flags ? { pattern, flags } : { pattern };
}

function normalizeTransforms(
  raw: unknown,
  where: string,
  warnings: string[],
): SourceTransform[] {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const out: SourceTransform[] = [];
  arr.forEach((item, i) => {
    if (typeof item !== 'object' || item === null) {
      warnings.push(`${where}: transform #${i + 1} must be an object; ignoring.`);
      return;
    }
    const o = item as Record<string, unknown>;
    const pattern = typeof o.pattern === 'string' ? o.pattern : '';
    if (!pattern) return;
    const flags = typeof o.flags === 'string' && o.flags ? o.flags : undefined;
    const err = regexError(pattern, flags ?? 'g');
    if (err) {
      warnings.push(`${where}: transform #${i + 1} ignored. ${err}`);
      return;
    }
    const t: SourceTransform = {
      pattern,
      replacement: typeof o.replacement === 'string' ? o.replacement : '',
    };
    if (flags) t.flags = flags;
    out.push(t);
  });
  return out;
}

export function validateBundle(raw: unknown): ValidationResult<ConfigBundle> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: ['Top-level value must be a JSON object.'], warnings };
  }
  const o = raw as Record<string, unknown>;

  const rawSources = Array.isArray(o.sources) ? o.sources : null;
  if (!rawSources) {
    return { ok: false, errors: ['Missing "sources" array.'], warnings };
  }
  if (rawSources.length === 0) {
    warnings.push('Config contains zero sources.');
  }

  const sources: Source[] = [];
  const seenIds = new Set<string>();
  rawSources.forEach((s, i) => {
    const norm = normalizeSource(s, errors, warnings, i);
    if (!norm) return;
    if (seenIds.has(norm.id)) {
      norm.id = newId();
      warnings.push(`Source #${i + 1} ("${norm.name}"): duplicate id, reassigned a new one.`);
    }
    seenIds.add(norm.id);
    sources.push(norm);
  });

  let settings: Partial<Settings> | undefined;
  if (o.settings && typeof o.settings === 'object') {
    const s = o.settings as Record<string, unknown>;
    settings = {};
    if (typeof s.placeholder === 'string' && s.placeholder) settings.placeholder = s.placeholder;
    if (typeof s.groupByCategory === 'boolean') settings.groupByCategory = s.groupByCategory;
    if (typeof s.openMultipleInBackground === 'boolean')
      settings.openMultipleInBackground = s.openMultipleInBackground;
    if (typeof s.showAllItem === 'boolean') settings.showAllItem = s.showAllItem;
  }

  const version = typeof o.version === 'number' ? o.version : CONFIG_VERSION;

  const ok = errors.length === 0;
  return {
    ok,
    value: ok ? { version, sources, settings } : undefined,
    errors,
    warnings,
  };
}

export function buildExport(sources: Source[], settings: Settings, isoDate: string): ConfigBundle {
  return {
    version: CONFIG_VERSION,
    exportedAt: isoDate,
    settings,
    sources: sources.map((s) => stripRuntime(s)),
  };
}

export function stripRuntime(s: Source): Source {
  const { origin, ...rest } = s;
  void origin;
  return rest;
}

export function sourceSignature(s: Source): string {
  return [
    s.name.trim(),
    s.url.trim(),
    s.method,
    s.body ?? '',
    s.contentType ?? '',
    s.encoding,
    s.refang ? '1' : '0',
    s.category?.trim() ?? '',
    [...s.types].sort().join(','),
    s.match ? JSON.stringify(s.match) : '',
    s.transform?.length ? JSON.stringify(s.transform) : '',
  ].join(' ');
}
