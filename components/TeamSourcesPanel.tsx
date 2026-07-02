import type { LocalConfig, RemoteCache } from '../lib/types';
import { sourceSignature } from '../lib/schema';
import { SourceRow } from './SourceRow';

function timeAgo(ts: number): string {
  if (!ts) return 'never';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function TeamSourcesPanel(props: {
  config: LocalConfig;
  cache: RemoteCache | null;
  mutate: (fn: (c: LocalConfig) => void) => Promise<unknown>;
}) {
  const { config, cache, mutate } = props;
  if (!cache || cache.sources.length === 0) return null;

  const personalSigs = new Set(config.sources.map(sourceSignature));

  const setOverrideDisabled = (id: string, disabled: boolean) =>
    mutate((c) => {
      const ov = c.overrides[id] ?? {};
      if (disabled) ov.disabled = true;
      else delete ov.disabled;
      if (Object.keys(ov).length === 0) delete c.overrides[id];
      else c.overrides[id] = ov;
    });

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>
          Synced sources{' '}
          <span className="muted" style={{ fontWeight: 400 }}>· {cache.sources.length}</span>
        </h2>
        <span className="muted">Last sync: {timeAgo(config.remote.lastSync)}</span>
      </div>
      <div className="panel-body">
        <div className="src-list">
          {cache.sources.map((s) => {
            const disabled = config.overrides[s.id]?.disabled === true;
            return (
              <SourceRow
                key={s.id}
                source={{ ...s, origin: 'remote', enabled: !disabled }}
                placeholder={config.settings.placeholder || '%s'}
                readOnly
                duplicate={personalSigs.has(sourceSignature(s))}
                onToggle={(v) => setOverrideDisabled(s.id, !v)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
