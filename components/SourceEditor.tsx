import { useMemo, useState } from 'react';
import type { Source, IndicatorType, Encoding, HttpMethod } from '../lib/types';
import { ALL_INDICATOR_TYPES, INDICATOR_META } from '../lib/indicators';
import { buildRequest, prepareValue } from '../lib/template';
import { Field, Modal, Toggle } from './ui';

function highlightSub(template: string, placeholder: string, value: string): React.ReactNode {
  if (!placeholder || !template.includes(placeholder)) return template;
  const parts = template.split(placeholder);
  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {i < parts.length - 1 && <span className="ph-hl">{value}</span>}
    </span>
  ));
}

const SAMPLES: Record<IndicatorType, string> = {
  any: 'example.com',
  ipv4: '8.8.8.8',
  ipv6: '2001:4860:4860::8888',
  domain: 'example.com',
  url: 'https://example.com/path?q=1',
  email: 'user@example.com',
  md5: 'd41d8cd98f00b204e9800998ecf8427e',
  sha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
  sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  cve: 'CVE-2024-3094',
};

export function SourceEditor(props: {
  initial: Source;
  categories: string[];
  placeholder: string;
  onSave: (s: Source) => void;
  onClose: () => void;
}) {
  const [s, setS] = useState<Source>({ ...props.initial });
  const set = <K extends keyof Source>(k: K, v: Source[K]) => setS((p) => ({ ...p, [k]: v }));

  const toggleType = (t: IndicatorType) => {
    setS((p) => {
      const has = p.types.includes(t);
      let next = has ? p.types.filter((x) => x !== t) : [...p.types, t];
      if (t === 'any' && !has) next = ['any'];
      else if (t !== 'any') next = next.filter((x) => x !== 'any');
      if (next.length === 0) next = ['any'];
      return { ...p, types: next };
    });
  };

  const nameErr = !s.name.trim();
  const urlErr = !s.url.trim();
  const noPlaceholder =
    !s.url.includes(props.placeholder) && !(s.body ?? '').includes(props.placeholder);

  const preview = useMemo(() => {
    if (urlErr) return { ok: false, node: 'Enter a URL template to preview.' as React.ReactNode };
    const sampleType = s.types.find((t) => t !== 'any') ?? 'domain';
    const sample = SAMPLES[sampleType] ?? 'example.com';
    try {
      const req = buildRequest(s, sample, props.placeholder);
      const sub = prepareValue(sample, { encoding: s.encoding, refang: s.refang });
      const node = (
        <>
          {req.method} {highlightSub(s.url, props.placeholder, sub)}
          {req.method === 'POST' && req.body != null && (
            <>
              {'\n\nPOST body:\n'}
              {highlightSub(s.body ?? '', props.placeholder, sub)}
            </>
          )}
        </>
      );
      return { ok: true, node };
    } catch (e) {
      return { ok: false, node: `Invalid: ${(e as Error).message}` as React.ReactNode };
    }
  }, [s, urlErr, props.placeholder]);

  const canSave = !nameErr && !urlErr;

  return (
    <Modal
      title={props.initial.name ? `Edit "${props.initial.name}"` : 'New source'}
      onClose={props.onClose}
      footer={
        <>
          <button className="btn" onClick={props.onClose}>Cancel</button>
          <button
            className="btn primary"
            disabled={!canSave}
            onClick={() => props.onSave({ ...s, name: s.name.trim(), url: s.url.trim() })}
          >
            Save source
          </button>
        </>
      }
    >
      <div className="row">
        <Field label="Name" desc="Shown in the right-click menu" htmlFor="f-name">
          <input
            id="f-name"
            type="text"
            className={nameErr ? 'invalid' : ''}
            value={s.name}
            placeholder="VirusTotal Lookup"
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <Field label="Category" desc="Groups items into submenus" htmlFor="f-cat">
          <input
            id="f-cat"
            type="text"
            list="cat-list"
            value={s.category ?? ''}
            placeholder="Threat Intel"
            onChange={(e) => set('category', e.target.value)}
          />
          <datalist id="cat-list">
            {props.categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>

      <Field
        label="URL template"
        desc={
          <>
            Use <span className="ph-hl">{props.placeholder}</span> where the selected text goes.
          </>
        }
        htmlFor="f-url"
      >
        <input
          id="f-url"
          type="text"
          className={urlErr ? 'invalid' : ''}
          value={s.url}
          placeholder={`https://example.com/search/${props.placeholder}`}
          onChange={(e) => set('url', e.target.value)}
        />
      </Field>

      {s.method === 'GET' && !urlErr && !s.url.includes(props.placeholder) && (
        <div className="notice warn" style={{ marginTop: -4 }}>
          <strong>Warning:</strong> This template has no <code>{props.placeholder}</code> placeholder.
          The selected text won't be inserted.
        </div>
      )}

      <div className="row">
        <Field label="Method" desc="How the request is sent" htmlFor="f-method">
          <select
            id="f-method"
            value={s.method}
            onChange={(e) => set('method', e.target.value as HttpMethod)}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </Field>
        <Field label="Encoding" desc="Applied to the inserted value" htmlFor="f-enc">
          <select
            id="f-enc"
            value={s.encoding}
            onChange={(e) => set('encoding', e.target.value as Encoding)}
          >
            <option value="none">None</option>
            <option value="url">URL-encode</option>
            <option value="base64">Base64</option>
          </select>
        </Field>
      </div>

      {s.method === 'POST' && (
        <>
          <Field
            label="POST body template"
            desc={
              <>
                Form-urlencoded, e.g. <code>key=value&amp;k2={props.placeholder}</code>. The
                placeholder works here too.
              </>
            }
            htmlFor="f-body"
          >
            <textarea
              id="f-body"
              value={s.body ?? ''}
              placeholder={`query=${props.placeholder}`}
              onChange={(e) => set('body', e.target.value)}
            />
          </Field>

          {noPlaceholder && (
            <div className="notice warn" style={{ marginTop: -4 }}>
              <strong>Warning:</strong> This template has no <code>{props.placeholder}</code> placeholder.
              The selected text won't be inserted.
            </div>
          )}

          <Field label="Content-Type" desc="Sent as the request's Content-Type header" htmlFor="f-ct">
            <input
              id="f-ct"
              type="text"
              value={s.contentType ?? 'application/x-www-form-urlencoded'}
              onChange={(e) => set('contentType', e.target.value)}
            />
          </Field>
        </>
      )}

      <Field
        label="Applies to indicator types"
        desc='Controls which items show under "Search all matching sources".'
      >
        <div className="type-grid">
          {ALL_INDICATOR_TYPES.map((t) => (
            <label key={t} className={`type-opt ${s.types.includes(t) ? 'on' : ''}`} title={INDICATOR_META[t].help}>
              <input
                type="checkbox"
                checked={s.types.includes(t)}
                onChange={() => toggleType(t)}
                style={{ width: 'auto' }}
              />
              {INDICATOR_META[t].label}
            </label>
          ))}
        </div>
      </Field>

      <div className="section-label">Options</div>

      <div className="row" style={{ marginTop: 8 }}>
        <Toggle
          checked={s.refang}
          onChange={(v) => set('refang', v)}
          label="Refang defanged indicators before searching"
        />
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <Toggle
          checked={s.openInBackground ?? false}
          onChange={(v) => set('openInBackground', v)}
          label="Open in a background tab"
        />
      </div>

      <div className="section-label">Live preview</div>
      <div className={`preview ${preview.ok ? '' : 'invalid'}`}>{preview.node}</div>
    </Modal>
  );
}
