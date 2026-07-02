import { useState } from 'react';
import type { LocalConfig } from '../lib/types';
import { defaultLocalConfig } from '../lib/schema';
import { clearRemoteCache } from '../lib/storage';
import { Field, Toggle, useToast } from './ui';

export function SettingsTab(props: {
  config: LocalConfig;
  mutate: (fn: (c: LocalConfig) => void) => Promise<unknown>;
}) {
  const { config, mutate } = props;
  const s = config.settings;
  const toast = useToast();

  const [editingPh, setEditingPh] = useState(false);
  const [phDraft, setPhDraft] = useState(s.placeholder);

  const startEditPh = () => {
    setPhDraft(s.placeholder);
    setEditingPh(true);
  };

  const savePh = async () => {
    const value = phDraft.trim();
    if (!value) {
      toast('Placeholder cannot be empty', 'error');
      return;
    }
    await mutate((c) => {
      c.settings.placeholder = value;
    });
    setEditingPh(false);
    toast('Placeholder saved', 'ok');
  };

  const resetAll = async () => {
    if (
      !confirm(
        'Restore all settings and sources to their defaults? This cannot be undone.',
      )
    )
      return;
    await mutate((c) => Object.assign(c, defaultLocalConfig()));
    await clearRemoteCache();
    toast('Extension reset to defaults', 'ok');
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Settings</h2>
      </div>
      <div className="panel-body">
        <Field
          label="Placeholder token"
          desc={
            <>
              The token in your URL/body templates that gets replaced by the selected text (
              <code>%s</code> by default).
            </>
          }
          htmlFor="ph"
        >
          {editingPh ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                id="ph"
                type="text"
                autoFocus
                value={phDraft}
                placeholder="%s"
                style={{ maxWidth: 160 }}
                onChange={(e) => setPhDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void savePh();
                  if (e.key === 'Escape') setEditingPh(false);
                }}
              />
              <button className="btn primary sm" onClick={savePh}>Save</button>
              <button className="btn sm" onClick={() => setEditingPh(false)}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                id="ph"
                type="text"
                value={s.placeholder}
                disabled
                style={{ maxWidth: 160 }}
              />
              <button className="btn sm" onClick={startEditPh}>Edit</button>
            </div>
          )}
          <div style={{ marginTop: 8, color: 'var(--text-dim)', fontSize: 12.5 }}>
            <span style={{ fontWeight: 600, marginRight: 8 }}>Example:</span>
            <span className="mono">
              https://www.shodan.io/search?query=
              <span className="ph-hl">{(editingPh ? phDraft : s.placeholder) || '%s'}</span>
            </span>
          </div>
          <div className="explain" style={{ marginTop: 8, fontSize: 12.5 }}>
            If you change the placeholder token, be sure to update it in any sources you've already
            added.
          </div>
        </Field>

        <div className="section-label">Menu behaviour</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, margin: '10px 0 6px' }}>
          <Toggle
            checked={s.groupByCategory}
            onChange={(v) => mutate((c) => { c.settings.groupByCategory = v; })}
            label="Group sources into category submenus"
          />
          <Toggle
            checked={s.showAllItem}
            onChange={(v) => mutate((c) => { c.settings.showAllItem = v; })}
            label={<>Show <strong>Search all matching sources</strong> item</>}
          />
          <Toggle
            checked={s.openMultipleInBackground}
            onChange={(v) => mutate((c) => { c.settings.openMultipleInBackground = v; })}
            label={<>Open <strong>Search all</strong> results in background tabs</>}
          />
        </div>

        <div className="section-label">Reset</div>
        <p className="explain" style={{ marginTop: 4 }}>
          Restore all settings and sources to their defaults.
        </p>
        <button className="btn danger" onClick={resetAll}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
