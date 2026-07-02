import { useState } from 'react';
import type { LocalConfig, RemoteCache, Source } from '../lib/types';
import { newId, sourceSignature } from '../lib/schema';
import { SourceEditor } from './SourceEditor';
import { SourceRow } from './SourceRow';
import { TeamSourcesPanel } from './TeamSourcesPanel';
import { useToast } from './ui';

function blankSource(): Source {
  return {
    id: newId(),
    name: '',
    category: '',
    method: 'GET',
    url: '',
    encoding: 'url',
    refang: true,
    types: ['any'],
    enabled: true,
  };
}

export function SourcesTab(props: {
  config: LocalConfig;
  cache: RemoteCache | null;
  mutate: (fn: (c: LocalConfig) => void) => Promise<unknown>;
}) {
  const { config, cache, mutate } = props;
  const toast = useToast();
  const [editing, setEditing] = useState<Source | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const categories = Array.from(
    new Set(config.sources.map((s) => s.category).filter((c): c is string => !!c)),
  ).sort();

  const syncedSigs = new Set((cache?.sources ?? []).map(sourceSignature));

  const openNew = () => {
    setEditing(blankSource());
    setIsNew(true);
  };
  const openEdit = (s: Source) => {
    setEditing({ ...s });
    setIsNew(false);
  };

  const save = async (s: Source) => {
    await mutate((c) => {
      const idx = c.sources.findIndex((x) => x.id === s.id);
      if (idx === -1) c.sources.push(s);
      else c.sources[idx] = s;
    });
    setEditing(null);
    toast(isNew ? 'Source added' : 'Source saved', 'ok');
  };

  const remove = async (s: Source) => {
    if (!confirm(`Delete "${s.name}"?`)) return;
    await mutate((c) => {
      c.sources = c.sources.filter((x) => x.id !== s.id);
    });
    toast('Source deleted', 'ok');
  };

  const toggle = (s: Source, enabled: boolean) =>
    mutate((c) => {
      const t = c.sources.find((x) => x.id === s.id);
      if (t) t.enabled = enabled;
    });

  const reorder = async (from: number, to: number) => {
    if (from === to) return;
    await mutate((c) => {
      const arr = c.sources;
      const [moved] = arr.splice(from, 1);
      if (moved) arr.splice(to, 0, moved);
    });
  };

  return (
    <>
    <div className="panel">
      <div className="panel-head">
        <h2>Your sources <span className="muted" style={{ fontWeight: 400 }}>· {config.sources.length}</span></h2>
        <button className="btn primary sm" onClick={openNew}>+ Add source</button>
      </div>
      <div className="panel-body">
        {config.sources.length === 0 ? (
          <div className="empty">
            No sources yet.<br />
            Click <strong>Add source</strong> to create your first smart-keyword lookup.
          </div>
        ) : (
          <div className="src-list">
            {config.sources.map((s, i) => (
              <SourceRow
                key={s.id}
                source={s}
                placeholder={config.settings.placeholder || '%s'}
                duplicate={syncedSigs.has(sourceSignature(s))}
                draggable
                dragging={dragIndex === i}
                dropTarget={overIndex === i && dragIndex !== i}
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverIndex(i);
                }}
                onDrop={() => {
                  if (dragIndex !== null) void reorder(dragIndex, i);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onToggle={(v) => toggle(s, v)}
                onEdit={() => openEdit(s)}
                onDelete={() => remove(s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>

    <TeamSourcesPanel config={config} cache={cache} mutate={mutate} />

    {editing && (
      <SourceEditor
        initial={editing}
        categories={categories}
        placeholder={config.settings.placeholder || '%s'}
        onSave={save}
        onClose={() => setEditing(null)}
      />
    )}
    </>
  );
}
