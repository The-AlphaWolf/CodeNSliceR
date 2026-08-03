import { useState } from 'react';
import { EditorPane } from './EditorPane';
import { Controls } from './Controls';
import { LevelSelect } from './LevelSelect';
import { ResultModal } from './ResultModal';
import { BriefingPanel } from './panels/BriefingPanel';
import { RegisterPanel } from './panels/RegisterPanel';
import { BitGrid } from './panels/BitGrid';
import { RamPanel } from './panels/RamPanel';
import { QueuePanel } from './panels/QueuePanel';
import { useGame } from '@/state/store';
import { LEVELS } from '@/levels';
import { solvedCount } from '@/state/storage';

export function App() {
  const [rosterOpen, setRosterOpen] = useState(false);
  const level = useGame((s) => s.level);
  const progress = useGame((s) => s.progress);

  return (
    <div className="app">
      {/* Decorative corner rules of the blueprint frame. */}
      <div className="frame" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">CodeNSliceR</span>
          <span className="brand-sub">5G packet-classifier puzzle game</span>
        </div>
        <button className="btn btn-quiet level-button" onClick={() => setRosterOpen(true)}>
          <b>{level.id}</b> {level.title}
          <em>
            {solvedCount(progress)}/{LEVELS.length} closed
          </em>
        </button>
      </header>

      <main className="workspace">
        <BriefingPanel />

        <section className="center-pane">
          <EditorPane />
          <Controls />
        </section>

        <aside className="machine-pane">
          <RegisterPanel />
          <BitGrid />
          <RamPanel />
          <QueuePanel />
        </aside>
      </main>

      {rosterOpen && <LevelSelect onClose={() => setRosterOpen(false)} />}
      <ResultModal />

      <div className="too-small">
        <p>
          CodeNSliceR needs a wide screen — the editor, the machine panels and the traffic
          queues all have to be visible at once. Come back on a desktop.
        </p>
      </div>
    </div>
  );
}
