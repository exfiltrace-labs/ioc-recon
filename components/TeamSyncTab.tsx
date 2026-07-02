import { useState } from 'react';
import type { LocalConfig } from '../lib/types';
import { requestHostPermission, syncRemote, originPattern } from '../lib/remote';
import { clearRemoteCache } from '../lib/storage';
import { Field, useToast } from './ui';

function timeAgo(ts: number): string {
  if (!ts) return 'never';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function TeamSyncTab(props: {
  config: LocalConfig;
  mutate: (fn: (c: LocalConfig) => void) => Promise<unknown>;
}) {
  const { config, mutate } = props;
  const toast = useToast();
  const [urlDraft, setUrlDraft] = useState(config.remote.url);
  const [busy, setBusy] = useState(false);

  const patternValid = !urlDraft.trim() || !!originPattern(urlDraft.trim());

  const saveAndSync = async () => {
    const url = urlDraft.trim();
    if (!url || !originPattern(url)) {
      toast('Enter a valid http(s) URL', 'error');
      return;
    }
    setBusy(true);
    try {
      const granted = await requestHostPermission(url);
      if (!granted) {
        toast('Permission denied, cannot fetch the config', 'error');
        return;
      }
      await mutate((c) => {
        c.remote.url = url;
      });
      const outcome = await syncRemote({ force: true });
      if (outcome.status !== 'error') toast(outcome.message, 'ok');
      if (outcome.warnings?.length) {
        console.warn('[IOC Recon] sync warnings:', outcome.warnings);
      }
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setBusy(true);
    try {
      const outcome = await syncRemote({ force: true });
      if (outcome.status !== 'error') toast(outcome.message, 'ok');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Stop syncing from the remote URL? Any locally configured sources will remain.')) return;
    await mutate((c) => {
      c.remote.url = '';
      c.remote.lastEtag = '';
      c.remote.lastStatus = '';
      c.remote.lastError = '';
      c.remote.lastSync = 0;
    });
    await clearRemoteCache();
    setUrlDraft('');
    toast('Disconnected from team config', 'ok');
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Remote sync</h2>
      </div>
        <div className="panel-body">
          <p className="explain" style={{ marginTop: 4 }}>
            Pull sources from a remote JSON URL.
          </p>

          <Field label="Remote config URL" htmlFor="remote-url">
            <input
              id="remote-url"
              type="url"
              className={patternValid ? '' : 'invalid'}
              placeholder="https://raw.githubusercontent.com/org/repo/main/config.json"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
            />
          </Field>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" disabled={busy || !patternValid} onClick={saveAndSync}>
              {busy ? 'Working…' : 'Grant & sync'}
            </button>
            <button
              className="btn"
              disabled={busy || !config.remote.url}
              onClick={syncNow}
            >
              Sync now
            </button>
            {config.remote.url && (
              <button className="btn danger" disabled={busy} onClick={disconnect}>
                Disconnect
              </button>
            )}
          </div>

          {config.remote.url && config.remote.lastError ? (
            <div className="notice error" style={{ marginTop: 14 }}>
              <strong>Sync failed:</strong> {config.remote.lastError}
            </div>
          ) : config.remote.url && config.remote.lastSync ? (
            <div className="notice ok" style={{ marginTop: 14 }}>
              <strong>Last sync:</strong> {timeAgo(config.remote.lastSync)} ·{' '}
              {config.remote.lastStatus || 'ok'}
            </div>
          ) : null}

          <p className="explain" style={{ marginTop: 14, fontSize: 12.5 }}>
            Refreshes when you start your browser, or hit <strong>Sync now</strong> to pull right away.
            Synced sources show up under the <strong>Sources</strong> tab.
          </p>
        </div>
      </div>
  );
}
