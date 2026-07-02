import { useRef, useState } from 'react';
import type { ConfigBundle, LocalConfig, Source } from '../lib/types';
import { buildExport, validateBundle, newId, sourceSignature } from '../lib/schema';
import { useToast } from './ui';

type Parsed = {
  bundle: ConfigBundle | null;
  errors: string[];
  warnings: string[];
};

function plural(n: number, word: string): string {
  return `${word}${n === 1 ? '' : 's'}`;
}

export function ImportExportTab(props: {
  config: LocalConfig;
  mutate: (fn: (c: LocalConfig) => void) => Promise<unknown>;
}) {
  const { config, mutate } = props;
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const exportJson = () =>
    JSON.stringify(buildExport(config.sources, config.settings, new Date().toISOString()), null, 2);

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ioc-recon-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Config downloaded', 'ok');
  };

  const copy = async () => {
    await navigator.clipboard.writeText(exportJson());
    toast('Copied to clipboard', 'ok');
  };

  const parse = (text: string) => {
    setRaw(text);
    if (!text.trim()) {
      setParsed(null);
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      setParsed({ bundle: null, errors: ['This doesn’t look like valid JSON.'], warnings: [] });
      return;
    }
    const res = validateBundle(json);
    setParsed({ bundle: res.value ?? null, errors: res.errors, warnings: res.warnings });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    parse(await file.text());
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void onFile(e.dataTransfer.files?.[0]);
  };

  const apply = async (mode: 'merge' | 'replace') => {
    if (!parsed?.bundle) return;
    const incoming = parsed.bundle.sources;
    let added = 0;
    let skipped = 0;
    await mutate((c) => {
      if (mode === 'replace') {
        c.sources = incoming.map((s) => ({ ...s }));
      } else {
        const sigs = new Set(c.sources.map(sourceSignature));
        const ids = new Set(c.sources.map((s) => s.id));
        for (const s of incoming) {
          const copy: Source = { ...s };
          if (sigs.has(sourceSignature(copy))) {
            skipped++;
            continue;
          }
          if (ids.has(copy.id)) copy.id = newId();
          c.sources.push(copy);
          ids.add(copy.id);
          sigs.add(sourceSignature(copy));
          added++;
        }
      }
      if (parsed.bundle?.settings) {
        c.settings = { ...c.settings, ...parsed.bundle.settings };
      }
    });
    toast(
      mode === 'replace'
        ? `Replaced with ${incoming.length} ${plural(incoming.length, 'source')}`
        : `Imported ${added} ${plural(added, 'source')}${
            skipped ? `, skipped ${skipped} ${plural(skipped, 'duplicate')}` : ''
          }`,
      'ok',
    );
    setRaw('');
    setParsed(null);
    setFileName(null);
  };

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Export</h2>
        </div>
        <div className="panel-body">
          <p className="explain" style={{ marginTop: 4 }}>
            Exports your <strong>{config.sources.length}</strong> {plural(config.sources.length, 'source')}{' '}
            and settings as a JSON file.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary" onClick={download}>Download JSON</button>
            <button className="btn" onClick={copy}>Copy to clipboard</button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Import</h2>
        </div>
        <div className="panel-body">
          <p className="explain" style={{ marginTop: 4 }}>
            Load sources from a JSON file or paste them below. Duplicate sources are skipped
            automatically.
          </p>

          <div
            className={`dropzone ${dragOver ? 'over' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="dz-icon">⭳</div>
            {fileName ? (
              <div>
                <strong>{fileName}</strong> · click or drop to replace
              </div>
            ) : (
              <div>
                Drag a JSON file here, or <span className="dz-link">click to browse</span>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />

          <div className="or-sep">or paste JSON</div>

          <textarea
            value={raw}
            placeholder="Paste config JSON here"
            onChange={(e) => {
              setFileName(null);
              parse(e.target.value);
            }}
            style={{ minHeight: 140 }}
          />

          {parsed?.errors.length ? (
            <div className="notice error">
              <strong>Cannot import. {parsed.errors.length} {plural(parsed.errors.length, 'error')}:</strong>
              <ul>{parsed.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          ) : null}

          {parsed?.warnings.length ? (
            <div className="notice warn">
              <strong>{parsed.warnings.length} {plural(parsed.warnings.length, 'warning')}:</strong>
              <ul>{parsed.warnings.slice(0, 8).map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          ) : null}

          {parsed?.bundle && (() => {
            const existing = new Set(config.sources.map(sourceSignature));
            const total = parsed.bundle.sources.length;
            const dupes = parsed.bundle.sources.filter((s) => existing.has(sourceSignature(s))).length;
            return (
            <>
              <div className="notice ok">
                Validated <strong>{total}</strong> {plural(total, 'source')}.{' '}
                {dupes > 0 && (
                  <>
                    <strong>{dupes}</strong> {plural(dupes, 'source')} {dupes === 1 ? 'is' : 'are'} already in your list and won’t be added.{' '}
                  </>
                )}
                Choose an option below.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn primary" onClick={() => apply('merge')}>
                  Add to my sources
                </button>
                <button className="btn danger" onClick={() => apply('replace')}>
                  Replace my sources
                </button>
              </div>
            </>
            );
          })()}
        </div>
      </div>
    </>
  );
}
