import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { LocalConfig, RemoteCache } from '../lib/types';
import { getLocalConfig, getRemoteCache, updateLocalConfig } from '../lib/storage';

export function useConfig() {
  const [config, setConfig] = useState<LocalConfig | null>(null);
  const [cache, setCache] = useState<RemoteCache | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [c, rc] = await Promise.all([getLocalConfig(), getRemoteCache()]);
    setConfig(c);
    setCache(rc);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    const listener = (_changes: unknown, area: string) => {
      if (area === 'sync' || area === 'local') void reload();
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, [reload]);

  const mutate = useCallback(async (fn: (cfg: LocalConfig) => void) => {
    const updated = await updateLocalConfig(fn);
    setConfig({ ...updated });
    return updated;
  }, []);

  return { config, cache, loading, mutate } as const;
}
