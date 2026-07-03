import type { IndicatorType, DetectedIndicator, Source } from './types';
import { compileRegex } from './regex';

export const INDICATOR_META: Record<IndicatorType, { label: string; help: string }> = {
  any: { label: 'Any', help: 'Matches every selection' },
  ipv4: { label: 'IPv4', help: 'e.g. 8.8.8.8' },
  ipv6: { label: 'IPv6', help: 'e.g. 2001:4860:4860::8888' },
  domain: { label: 'Domain', help: 'e.g. example.com' },
  url: { label: 'URL', help: 'e.g. https://example.com/path' },
  email: { label: 'Email', help: 'e.g. user@example.com' },
  md5: { label: 'MD5', help: '32 hex chars' },
  sha1: { label: 'SHA1', help: '40 hex chars' },
  sha256: { label: 'SHA256', help: '64 hex chars' },
  sha512: { label: 'SHA512', help: '128 hex chars' },
  cve: { label: 'CVE', help: 'e.g. CVE-2024-3094' },
  cwe: { label: 'CWE', help: 'e.g. CWE-79' },
  asn: { label: 'ASN', help: 'e.g. AS15169' },
  crypto: { label: 'Crypto', help: 'BTC / ETH / XMR address' },
  mac: { label: 'MAC', help: 'e.g. 8C:1F:64:70:D4:2A' },
};

export const ALL_INDICATOR_TYPES: IndicatorType[] = [
  'any', 'ipv4', 'ipv6', 'domain', 'url', 'email',
  'md5', 'sha1', 'sha256', 'sha512', 'cve', 'cwe', 'asn', 'crypto', 'mac',
];

export function refang(input: string): string {
  let s = input.trim();
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
  s = s.replace(/^[<"'(\[]+|[>"')\]]+$/g, '');
  s = s.replace(/h[xX]{2}p(s?)\b/g, 'http$1');
  s = s.replace(/\[\.\]|\(\.\)|\{\.\}|\[dot\]|\(dot\)/gi, '.');
  s = s.replace(/\[:\/\/\]/g, '://').replace(/\[:\]/g, ':');
  s = s.replace(/\[@\]|\[at\]|\(at\)/gi, '@');
  s = s.replace(/\s*\.\s*/g, '.');
  return s.trim();
}

export function defang(input: string): string {
  let s = input.trim();
  s = s.replace(/\bhttps\b/gi, 'hxxps').replace(/\bhttp\b/gi, 'hxxp');
  s = s.replace(/\./g, '[.]');
  s = s.replace(/@/g, '[@]');
  return s;
}

const RE = {
  ipv4: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
  ipv6: /^(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,7}:|([0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,5}(:[0-9a-f]{1,4}){1,2}|([0-9a-f]{1,4}:){1,4}(:[0-9a-f]{1,4}){1,3}|([0-9a-f]{1,4}:){1,3}(:[0-9a-f]{1,4}){1,4}|([0-9a-f]{1,4}:){1,2}(:[0-9a-f]{1,4}){1,5}|[0-9a-f]{1,4}:((:[0-9a-f]{1,4}){1,6})|:((:[0-9a-f]{1,4}){1,7}|:))$/i,
  email: /^[^\s@"]+@[^\s@".]+\.[^\s@"]{2,}$/,
  url: /^[a-z][a-z0-9+.-]*:\/\/[^\s]+$/i,
  domain: /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/i,
  md5: /^[a-f0-9]{32}$/i,
  sha1: /^[a-f0-9]{40}$/i,
  sha256: /^[a-f0-9]{64}$/i,
  sha512: /^[a-f0-9]{128}$/i,
  cve: /^CVE-\d{4}-\d{4,7}$/i,
  cwe: /^CWE-\d{1,6}$/i,
  asn: /^AS\d{1,10}$/i,
  crypto:
    /^(?:0x[0-9a-fA-F]{40}|bc1[a-z0-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93,104})$/,
  mac: /^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$|^(?:[0-9a-f]{4}\.){2}[0-9a-f]{4}$|^[0-9a-f]{12}$/i,
};

export function detectTypes(refanged: string): IndicatorType[] {
  const v = refanged.trim();
  if (!v) return [];
  const types: IndicatorType[] = [];
  if (RE.url.test(v)) types.push('url');
  if (RE.email.test(v)) types.push('email');
  if (RE.ipv4.test(v)) types.push('ipv4');
  else if (RE.ipv6.test(v)) types.push('ipv6');
  if (RE.cve.test(v)) types.push('cve');
  if (RE.cwe.test(v)) types.push('cwe');
  if (RE.asn.test(v)) types.push('asn');
  if (RE.crypto.test(v)) types.push('crypto');
  if (RE.mac.test(v)) types.push('mac');
  if (RE.md5.test(v)) types.push('md5');
  else if (RE.sha1.test(v)) types.push('sha1');
  else if (RE.sha256.test(v)) types.push('sha256');
  else if (RE.sha512.test(v)) types.push('sha512');
  if (
    !types.includes('url') &&
    !types.includes('email') &&
    !types.includes('ipv4') &&
    !types.includes('ipv6') &&
    RE.domain.test(v)
  ) {
    types.push('domain');
  }
  return types;
}

export function detect(raw: string): DetectedIndicator {
  const refanged = refang(raw);
  return { raw, refanged, types: detectTypes(refanged) };
}

export function sourceMatches(sourceTypes: IndicatorType[], detected: IndicatorType[]): boolean {
  if (sourceTypes.includes('any')) return true;
  return sourceTypes.some((t) => detected.includes(t));
}

export function selectionMatchesSource(source: Source, detected: DetectedIndicator): boolean {
  if (!sourceMatches(source.types, detected.types)) return false;
  if (source.match?.pattern) {
    const re = compileRegex(source.match.pattern, source.match.flags);
    if (re && !re.test(detected.refanged)) return false;
  }
  return true;
}
