import type { Source } from '../lib/types';
import { INDICATOR_META } from '../lib/indicators';
import { Toggle } from './ui';

function highlightToken(text: string, token: string): React.ReactNode {
  if (!token || !text.includes(token)) return text;
  const parts = text.split(token);
  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {i < parts.length - 1 && <span className="ph-hl">{token}</span>}
    </span>
  ));
}

export function SourceRow(props: {
  source: Source;
  placeholder?: string;
  readOnly?: boolean;
  duplicate?: boolean;
  draggable?: boolean;
  dragging?: boolean;
  dropTarget?: boolean;
  onToggle?: (enabled: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  rightSlot?: React.ReactNode;
}) {
  const s = props.source;
  const cls = [
    'src-row',
    props.readOnly ? 'readonly' : '',
    props.dragging ? 'dragging' : '',
    props.dropTarget ? 'drop-target' : '',
    s.enabled === false ? 'disabled' : '',
  ].join(' ').trim();

  return (
    <div
      className={cls}
      draggable={props.draggable}
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
      onDragEnd={props.onDragEnd}
    >
      {props.draggable && <span className="drag-handle" title="Drag to reorder">⠿</span>}
      <div className="src-main">
        <div className="src-name">
          {props.duplicate && (
            <span
              className="dup-icon"
              title="This source appears in both your sources and synced sources; the synced copy is the one used."
              aria-label="Also exists as a synced source"
            >
              <svg
                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </span>
          )}
          {s.name}
        </div>
        <div className="src-url">{highlightToken(s.url, props.placeholder || '%s')}</div>
        <div className="chips">
          <span className="chip method">{s.method}</span>
          {s.category && <span className="chip cat">{s.category}</span>}
          {s.types.map((t) => (
            <span key={t} className="chip type">{INDICATOR_META[t].label}</span>
          ))}
        </div>
      </div>
      <div className="src-actions">
        {props.rightSlot}
        {props.onToggle && (
          <Toggle checked={s.enabled !== false} onChange={props.onToggle} />
        )}
        {props.onEdit && (
          <button className="btn sm" onClick={props.onEdit}>Edit</button>
        )}
        {props.onDelete && (
          <button className="btn sm danger icon" onClick={props.onDelete} aria-label="Delete" title="Delete">
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
        )}
      </div>
    </div>
  );
}
