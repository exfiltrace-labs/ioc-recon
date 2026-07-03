import { useEffect, useMemo, useRef, useState } from 'react';
import type { Source, IndicatorType, Encoding, HttpMethod, SourceTransform } from '../lib/types';
import { ALL_INDICATOR_TYPES, INDICATOR_META, refang } from '../lib/indicators';
import { buildRequest, prepareValue } from '../lib/template';
import { compileRegex, regexError } from '../lib/regex';
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

function cleanSource(src: Source): Source {
  const out: Source = { ...src, name: src.name.trim(), url: src.url.trim() };
  const pattern = out.match?.pattern.trim();
  if (pattern) {
    const flags = out.match?.flags?.trim();
    out.match = flags ? { pattern, flags } : { pattern };
  } else {
    delete out.match;
  }
  const tf = (out.transform ?? []).filter((t) => t.pattern);
  if (tf.length) out.transform = tf;
  else delete out.transform;
  return out;
}

const REGEX_FLAGS: Array<{ flag: string; label: string }> = [
  { flag: 'i', label: 'Ignore case' },
  { flag: 'g', label: 'Global (all matches)' },
  { flag: 'm', label: 'Multiline (^ and $ per line)' },
  { flag: 's', label: 'Dot matches newline' },
];

function FlagPicker(props: { value: string; onChange: (flags: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setDropUp(window.innerHeight - rect.bottom < 220);
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const has = (f: string) => props.value.includes(f);
  const toggle = (f: string) => {
    const set = new Set(props.value.split(''));
    if (set.has(f)) set.delete(f);
    else set.add(f);
    props.onChange(REGEX_FLAGS.filter((x) => set.has(x.flag)).map((x) => x.flag).join(''));
  };

  return (
    <div className="flags-dd" ref={ref}>
      <button
        type="button"
        className="flags-trigger"
        aria-label={props.label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={props.value ? '' : 'flags-ph'}>{props.value || 'flags'}</span>
        <svg
          className={`flags-caret ${open ? 'open' : ''}`}
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={`flags-menu ${dropUp ? 'up' : ''}`}>
          {REGEX_FLAGS.map((f) => (
            <label key={f.flag} className="flags-opt">
              <input type="checkbox" checked={has(f.flag)} onChange={() => toggle(f.flag)} />
              <code>{f.flag}</code>
              {f.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
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
  sha512:
    'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  cve: 'CVE-2024-3094',
  cwe: 'CWE-79',
  asn: 'AS15169',
  crypto: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  mac: '8C:1F:64:70:D4:2A',
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

  const [showAdv, setShowAdv] = useState(
    Boolean(props.initial.match?.pattern || props.initial.transform?.length),
  );
  const [testInput, setTestInput] = useState('');

  const matchPattern = s.match?.pattern ?? '';
  const matchFlags = s.match?.flags ?? '';
  const setMatchField = (key: 'pattern' | 'flags', v: string) =>
    setS((p) => ({ ...p, match: { ...(p.match ?? { pattern: '' }), [key]: v } }));

  const transforms = s.transform ?? [];
  const setTransforms = (next: SourceTransform[]) => setS((p) => ({ ...p, transform: next }));
  const addTransform = () =>
    setTransforms([...transforms, { pattern: '', replacement: '', flags: 'g' }]);
  const updateTransform = (i: number, patch: Partial<SourceTransform>) =>
    setTransforms(transforms.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const removeTransform = (i: number) => {
    if (!confirm('Delete this transform rule?')) return;
    setTransforms(transforms.filter((_, idx) => idx !== i));
  };

  const matchErr = matchPattern ? regexError(matchPattern, matchFlags || undefined) : null;
  const defaultSample = SAMPLES[s.types.find((t) => t !== 'any') ?? 'domain'] || 'example.com';

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
    const sample = testInput.trim() || defaultSample;
    try {
      const req = buildRequest(s, sample, props.placeholder);
      const sub = prepareValue(sample, {
        encoding: s.encoding,
        refang: s.refang,
        transform: s.transform,
      });
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
  }, [s, urlErr, props.placeholder, testInput, defaultSample]);

  const gateMatch = useMemo(() => {
    if (!matchPattern || matchErr) return null;
    const re = compileRegex(matchPattern, matchFlags || undefined);
    if (!re) return null;
    return re.test(refang(testInput.trim() || defaultSample));
  }, [matchPattern, matchFlags, matchErr, testInput, defaultSample]);

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
            onClick={() => props.onSave(cleanSource(s))}
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
                Sent as the request body, e.g. <code>query={props.placeholder}</code>.
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

      {matchPattern.trim() && (
        <div className="match-note">
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          A match pattern configured below further limits when this source appears.
        </div>
      )}

      <hr className="modal-divider" />

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

      <hr className="modal-divider" />

      <button
        type="button"
        className="adv-toggle-btn"
        aria-expanded={showAdv}
        onClick={() => setShowAdv((v) => !v)}
      >
        <svg
          className={`adv-caret ${showAdv ? 'open' : ''}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        Advanced matching and transforms
      </button>

      {showAdv && (
        <div className="adv-body">
          <Field
            label="Match pattern (regex)"
            desc='Under "Search all matching sources", only include this source when the selected text matches this pattern. Leave blank to always include it.'
            htmlFor="f-match"
          >
            <div className="tf-row">
              <input
                id="f-match"
                type="text"
                className={matchErr ? 'invalid' : ''}
                value={matchPattern}
                placeholder="^T\d{4}(\.\d{3})?$"
                onChange={(e) => setMatchField('pattern', e.target.value)}
              />
              <FlagPicker
                label="Match flags"
                value={matchFlags}
                onChange={(f) => setMatchField('flags', f)}
              />
            </div>
          </Field>
          {matchErr && <div className="notice error">{matchErr}</div>}

          <div className="section-label">Transform rules</div>
          <p className="adv-hint">
            Each rule runs a regex find/replace on the selection, in order, before encoding. Use{' '}
            <code>$1</code> or <code>$2</code> in the replacement for capture groups.
          </p>
          {transforms.map((t, i) => {
            const err = t.pattern ? regexError(t.pattern, t.flags || 'g') : null;
            return (
              <div key={i}>
                <div className="tf-row">
                  <input
                    type="text"
                    className={err ? 'invalid' : ''}
                    value={t.pattern}
                    placeholder="find (regex), e.g. \."
                    aria-label={`Transform ${i + 1} find`}
                    onChange={(e) => updateTransform(i, { pattern: e.target.value })}
                  />
                  <input
                    type="text"
                    value={t.replacement}
                    placeholder="replace with, e.g. /"
                    aria-label={`Transform ${i + 1} replacement`}
                    onChange={(e) => updateTransform(i, { replacement: e.target.value })}
                  />
                  <FlagPicker
                    label={`Transform ${i + 1} flags`}
                    value={t.flags ?? ''}
                    onChange={(f) => updateTransform(i, { flags: f })}
                  />
                  <button
                    type="button"
                    className="btn sm danger icon"
                    aria-label="Remove rule"
                    title="Remove rule"
                    onClick={() => removeTransform(i)}
                  >
                    <svg
                      width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
                {err && <div className="notice error">{err}</div>}
              </div>
            );
          })}
          <button type="button" className="btn sm" onClick={addTransform}>
            + Add rule
          </button>
        </div>
      )}

      <hr className="modal-divider" />

      <div className="section-label">Live preview</div>
      <Field
        label="Test input"
        desc="Type a sample selection to preview the result."
        htmlFor="f-test"
      >
        <input
          id="f-test"
          type="text"
          value={testInput}
          placeholder={defaultSample}
          onChange={(e) => setTestInput(e.target.value)}
        />
      </Field>
      {testInput.trim() && gateMatch === false && (
        <div className="notice warn">
          <strong>Warning:</strong> This input doesn't satisfy the match pattern defined above.
        </div>
      )}
      <Field label="Result">
        <div className={`preview ${preview.ok ? '' : 'invalid'}`}>{preview.node}</div>
      </Field>
    </Modal>
  );
}
