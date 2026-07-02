import { useEffect, useState } from 'react';
import { useConfig } from '../../components/useConfig';
import { getEffectiveSources } from '../../lib/storage';
import { SourcesTab } from '../../components/SourcesTab';
import { TeamSyncTab } from '../../components/TeamSyncTab';
import { ImportExportTab } from '../../components/ImportExportTab';
import { SettingsTab } from '../../components/SettingsTab';

type TabKey = 'sources' | 'team' | 'settings';

export function App() {
  const { config, cache, loading, mutate } = useConfig();
  const [tab, setTab] = useState<TabKey>('sources');
  const [sourceCount, setSourceCount] = useState(0);

  useEffect(() => {
    void getEffectiveSources().then((s) => setSourceCount(s.length));
  }, [config, cache]);

  if (loading || !config) {
    return (
      <div className="app">
        <div className="empty">Loading…</div>
      </div>
    );
  }

  const teamCount = cache?.sources.length ?? 0;

  return (
    <div className="app">
      <div className="brand">
        <img className="brand-logo" src="/icons/icon-48.png" alt="" width={30} height={30} />
        <h1 className="wordmark">
          <span className="wm-ioc">IOC</span> <span className="wm-recon">Recon</span>
        </h1>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'sources' ? 'active' : ''}`} onClick={() => setTab('sources')}>
          <span className="tab-label" data-label="Sources">Sources</span>
          <span className="count">{sourceCount}</span>
        </button>
        <button className={`tab ${tab === 'team' ? 'active' : ''}`} onClick={() => setTab('team')}>
          <span className="tab-label" data-label="Import / Export">Import / Export</span>
          {teamCount > 0 && <span className="count">{teamCount}</span>}
        </button>
        <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
          <span className="tab-label" data-label="Settings">Settings</span>
        </button>
      </div>

      {tab === 'sources' && <SourcesTab config={config} cache={cache} mutate={mutate} />}
      {tab === 'team' && (
        <>
          <ImportExportTab config={config} mutate={mutate} />
          <TeamSyncTab config={config} mutate={mutate} />
        </>
      )}
      {tab === 'settings' && <SettingsTab config={config} mutate={mutate} />}

      <footer className="app-footer">
        <a
          href="https://github.com/exfiltrace-labs/ioc-recon"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/exfiltrace-labs/ioc-recon
        </a>
      </footer>
    </div>
  );
}
