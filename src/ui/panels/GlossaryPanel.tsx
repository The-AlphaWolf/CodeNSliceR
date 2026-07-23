import { useState } from 'react';
import { GLOSSARY, GLOSSARY_BY_ID } from '@/content/glossary';
import { useGame } from '@/state/store';

/** The codex. Terms used by the current level float to the top and stay expanded. */
export function GlossaryPanel() {
  const level = useGame((s) => s.level);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const relevant = new Set(level.glossary);
  const needle = query.trim().toLowerCase();

  const entries = GLOSSARY.filter(
    (g) =>
      !needle ||
      g.term.toLowerCase().includes(needle) ||
      (g.expansion ?? '').toLowerCase().includes(needle) ||
      g.body.toLowerCase().includes(needle),
  ).sort((a, b) => Number(relevant.has(b.id)) - Number(relevant.has(a.id)));

  return (
    <div className="codex">
      <input
        className="codex-search"
        placeholder="search terms…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {entries.length === 0 && <p className="codex-empty">Nothing matches “{query}”.</p>}
      {entries.map((entry) => {
        const expanded = open === entry.id || (open === null && relevant.has(entry.id));
        return (
          <article key={entry.id} className={`codex-entry${relevant.has(entry.id) ? ' codex-live' : ''}`}>
            <button className="codex-term" onClick={() => setOpen(expanded ? '' : entry.id)}>
              <span>{entry.term}</span>
              {entry.expansion && <em>{entry.expansion}</em>}
            </button>
            {expanded && (
              <div className="codex-body">
                <p>{entry.body}</p>
                {entry.simplification && (
                  <p className="codex-caveat">
                    <b>In this game:</b> {entry.simplification}
                  </p>
                )}
                <p className="codex-meta">
                  Levels {entry.levels.join(', ')}
                  {entry.related.length > 0 && (
                    <>
                      {' · '}
                      {entry.related.map((id) => GLOSSARY_BY_ID[id]?.term ?? id).join(', ')}
                    </>
                  )}
                </p>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
