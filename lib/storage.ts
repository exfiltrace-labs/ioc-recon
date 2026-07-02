import { browser } from 'wxt/browser';
import type { LocalConfig, RemoteCache, Source, SourceOverride } from './types';
import { defaultLocalConfig, CONFIG_VERSION, sourceSignature } from './schema';

const SYNC_KEY = 'config';
const LOCAL_KEY = 'remoteCache';

export async function getLocalConfig(): Promise<LocalConfig> {
  const data = await browser.storage.sync.get(SYNC_KEY);
  const stored = data[SYNC_KEY] as LocalConfig | undefined;
  if (!stored) {
    const fresh = defaultLocalConfig();
    await setLocalConfig(fresh);
    return fresh;
  }
  return migrate(stored);
}

export async function setLocalConfig(config: LocalConfig): Promise<void> {
  config.version = CONFIG_VERSION;
  await browser.storage.sync.set({ [SYNC_KEY]: config });
}

export async function updateLocalConfig(
  mutator: (cfg: LocalConfig) => void,
): Promise<LocalConfig> {
  const cfg = await getLocalConfig();
  mutator(cfg);
  await setLocalConfig(cfg);
  return cfg;
}

export async function getRemoteCache(): Promise<RemoteCache | null> {
  const data = await browser.storage.local.get(LOCAL_KEY);
  return (data[LOCAL_KEY] as RemoteCache | undefined) ?? null;
}

export async function setRemoteCache(cache: RemoteCache): Promise<void> {
  await browser.storage.local.set({ [LOCAL_KEY]: cache });
}

export async function clearRemoteCache(): Promise<void> {
  await browser.storage.local.remove(LOCAL_KEY);
}

function migrate(cfg: LocalConfig): LocalConfig {
  if (!cfg.settings) cfg.settings = defaultLocalConfig().settings;
  if (!cfg.overrides) cfg.overrides = {};
  if (!cfg.remote) cfg.remote = defaultLocalConfig().remote;
  if (!Array.isArray(cfg.sources)) cfg.sources = [];
  return cfg;
}

function applyOverride(source: Source, override: SourceOverride | undefined): Source | null {
  return override?.disabled ? null : source;
}

export async function getEffectiveSources(): Promise<Source[]> {
  const [config, cache] = await Promise.all([getLocalConfig(), getRemoteCache()]);
  const out: Source[] = [];

  if (cache?.ok) {
    for (const r of cache.sources) {
      const merged = applyOverride(r, config.overrides[r.id]);
      if (merged) out.push({ ...merged, origin: 'remote' });
    }
  }
  for (const p of config.sources) {
    out.push({ ...p, origin: 'local' });
  }

  const seen = new Set<string>();
  return out
    .filter((s) => s.enabled !== false)
    .filter((s) => {
      const sig = sourceSignature(s);
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
}
