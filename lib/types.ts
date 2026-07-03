export type HttpMethod = 'GET' | 'POST';

export type Encoding = 'none' | 'url' | 'base64';

export interface SourceMatch {
  pattern: string;
  flags?: string;
}

export interface SourceTransform {
  pattern: string;
  replacement: string;
  flags?: string;
}

export type IndicatorType =
  | 'any'
  | 'ipv4'
  | 'ipv6'
  | 'domain'
  | 'url'
  | 'email'
  | 'md5'
  | 'sha1'
  | 'sha256'
  | 'sha512'
  | 'cve'
  | 'cwe'
  | 'asn'
  | 'crypto'
  | 'mac';

export interface Source {
  id: string;
  name: string;
  category?: string;
  method: HttpMethod;
  url: string;
  body?: string;
  contentType?: string;
  encoding: Encoding;
  refang: boolean;
  types: IndicatorType[];
  enabled: boolean;
  openInBackground?: boolean;
  match?: SourceMatch;
  transform?: SourceTransform[];
  origin?: 'local' | 'remote';
}

export interface Settings {
  placeholder: string;
  groupByCategory: boolean;
  openMultipleInBackground: boolean;
  showAllItem: boolean;
}

export interface RemoteSettings {
  url: string;
  lastSync: number;
  lastEtag?: string;
  lastStatus?: string;
  lastError?: string;
}

export interface SourceOverride {
  disabled?: boolean;
}

export interface LocalConfig {
  version: number;
  sources: Source[];
  settings: Settings;
  overrides: Record<string, SourceOverride>;
  remote: RemoteSettings;
}

export interface RemoteCache {
  sources: Source[];
  fetchedAt: number;
  url: string;
  etag?: string;
  ok: boolean;
}

export interface ConfigBundle {
  version: number;
  exportedAt?: string;
  settings?: Partial<Settings>;
  sources: Source[];
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: string[];
  warnings: string[];
}

export interface DetectedIndicator {
  raw: string;
  refanged: string;
  types: IndicatorType[];
}
