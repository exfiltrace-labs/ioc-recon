import { browser } from 'wxt/browser';
import type { RemoteCache } from './types';
import { validateBundle } from './schema';
import { setRemoteCache, updateLocalConfig, getLocalConfig } from './storage';
import { isHttpProtocol } from './url';

export interface SyncOutcome {
  status: 'updated' | 'unchanged' | 'error';
  message: string;
  count?: number;
  warnings?: string[];
}

export function originPattern(url: string): string | null {
  try {
    const u = new URL(url);
    if (!isHttpProtocol(u.protocol)) return null;
    return `${u.protocol}//${u.host}/*`;
  } catch {
    return null;
  }
}

export async function hasHostPermission(url: string): Promise<boolean> {
  const pattern = originPattern(url);
  if (!pattern) return false;
  return browser.permissions.contains({ origins: [pattern] });
}

export async function requestHostPermission(url: string): Promise<boolean> {
  const pattern = originPattern(url);
  if (!pattern) return false;
  return browser.permissions.request({ origins: [pattern] });
}

export async function syncRemote(opts?: { force?: boolean }): Promise<SyncOutcome> {
  const config = await getLocalConfig();
  const url = config.remote.url.trim();
  if (!url) return { status: 'error', message: 'No team-config URL is set.' };

  const pattern = originPattern(url);
  if (!pattern) return { status: 'error', message: 'Team-config URL is not a valid http(s) URL.' };

  if (!(await hasHostPermission(url))) {
    return {
      status: 'error',
      message: 'Host permission for the config origin has not been granted. Open Options and click "Grant & sync".',
    };
  }

  const headers: Record<string, string> = {};
  if (!opts?.force && config.remote.lastEtag) headers['If-None-Match'] = config.remote.lastEtag;

  let res: Response;
  try {
    res = await fetch(url, { headers, cache: 'no-cache', redirect: 'follow' });
  } catch {
    return finishError('Could not reach that URL. Check the address and your connection.');
  }

  if (res.status === 304) {
    await touchSync(config.remote.lastEtag, 'Up to date (304).');
    return { status: 'unchanged', message: 'Already up to date.' };
  }
  if (!res.ok) {
    return finishError(
      res.status === 404
        ? 'File not found (404). Double-check the URL.'
        : `The server returned an error (HTTP ${res.status}).`,
    );
  }

  let text: string;
  try {
    text = await res.text();
  } catch {
    return finishError('Could not read the response from that URL.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return finishError(
      text.trimStart().startsWith('<')
        ? 'That URL returned a web page, not JSON. Make sure you are using the raw file link.'
        : 'That file is not valid JSON.',
    );
  }

  const result = validateBundle(parsed);
  if (!result.ok || !result.value) {
    return finishError('That file is not a valid IOC Recon config.');
  }

  const etag = res.headers.get('ETag') ?? undefined;
  const cache: RemoteCache = {
    sources: result.value.sources,
    fetchedAt: Date.now(),
    url,
    etag,
    ok: true,
  };
  await setRemoteCache(cache);
  await touchSync(etag, `Synced ${cache.sources.length} source(s).`);

  return {
    status: 'updated',
    message: `Synced ${cache.sources.length} source(s).`,
    count: cache.sources.length,
    warnings: result.warnings,
  };

  async function finishError(message: string): Promise<SyncOutcome> {
    await updateLocalConfig((c) => {
      c.remote.lastError = message;
    });
    return { status: 'error', message };
  }

  async function touchSync(etagValue: string | undefined, status: string): Promise<void> {
    await updateLocalConfig((c) => {
      c.remote.lastSync = Date.now();
      c.remote.lastEtag = etagValue ?? c.remote.lastEtag;
      c.remote.lastStatus = status;
      c.remote.lastError = '';
    });
  }
}
