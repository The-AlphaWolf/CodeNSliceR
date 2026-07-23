import { useState } from 'react';
import { LEVELS } from '@/levels';
import { useGame } from '@/state/store';
import {
  exportSolutions,
  importSolutions,
  isUnlocked,
  levelProgress,
  solvedCount,
} from '@/state/storage';

/** Campaign roster with lock state, par badges, and the export/import controls. */
export function LevelSelect({ onClose }: { onClose: () => void }) {
  const progress = useGame((s) => s.progress);
  const current = useGame((s) => s.level);
  const selectLevel = useGame((s) => s.selectLevel);
  const setProgress = useGame((s) => s.setProgress);
  const setNotice = useGame((s) => s.setNotice);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);

  const done = solvedCount(progress);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Campaign</h2>
          <span className="panel-note">
            {done}/{LEVELS.length} work orders closed
          </span>
          <button className="btn btn-quiet" onClick={onClose}>
            close
          </button>
        </header>

        <ul className="level-list">
          {LEVELS.map((level) => {
            const p = levelProgress(progress, level.id);
            const unlocked = isUnlocked(progress, level.id);
            return (
              <li
                key={level.id}
                className={`level-row${p.solved ? ' solved' : ''}${unlocked ? '' : ' locked'}${
                  level.id === current.id ? ' current' : ''
                }`}
              >
                <button
                  disabled={!unlocked}
                  onClick={() => {
                    selectLevel(level.id);
                    onClose();
                  }}
                >
                  <span className="level-num">{level.id}</span>
                  <span className="level-title">{level.title}</span>
                  <span className="level-ticket">{level.ticket}</span>
                  <span className="level-scores">
                    {p.solved ? (
                      <>
                        <Badge label="size" value={p.bestSize} par={level.par.size} />
                        <Badge label="cycles" value={p.bestSpeed} par={level.par.speed} />
                      </>
                    ) : unlocked ? (
                      <em>open</em>
                    ) : (
                      <em>locked</em>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="modal-foot">
          <button
            className="btn btn-quiet"
            onClick={() => {
              navigator.clipboard
                .writeText(exportSolutions(progress))
                .then(() => setNotice('Solutions copied to the clipboard.'))
                .catch(() => setNotice('Clipboard blocked by the browser.'));
              onClose();
            }}
          >
            Export solutions
          </button>
          <button className="btn btn-quiet" onClick={() => setShowImport((v) => !v)}>
            Import solutions
          </button>
        </footer>

        {showImport && (
          <div className="import-box">
            <textarea
              value={importText}
              placeholder="paste an exported bundle here"
              onChange={(e) => setImportText(e.target.value)}
            />
            <button
              className="btn"
              onClick={() => {
                const outcome = importSolutions(progress, importText);
                setNotice(outcome.message);
                if (outcome.ok && outcome.progress) {
                  setProgress(outcome.progress);
                  setImportText('');
                  setShowImport(false);
                  onClose();
                }
              }}
            >
              Load
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ label, value, par }: { label: string; value: number | null; par: number }) {
  if (value === null) return null;
  const beat = value < par;
  const met = value <= par;
  return (
    <span className={`badge${beat ? ' badge-gold' : met ? ' badge-met' : ''}`}>
      {label} {value}
      <em>/{par}</em>
    </span>
  );
}
