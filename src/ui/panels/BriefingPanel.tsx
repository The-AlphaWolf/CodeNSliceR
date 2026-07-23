import { useState } from 'react';
import { useGame, REVEAL_AFTER_FAILURES } from '@/state/store';
import { opsByCategory, OpCategory } from '@/vm/isa';
import { opsForTier } from '@/levels/schema';
import { BIN_BLURB, BIN_LABEL } from '@/vm/packets';
import { GlossaryPanel } from './GlossaryPanel';

type Tab = 'brief' | 'isa' | 'codex';

const CATEGORY_TITLES: Record<OpCategory, string> = {
  packet: 'Packets',
  data: 'Data',
  alu: 'ALU',
  control: 'Control',
  misc: 'Misc',
};

export function BriefingPanel() {
  const [tab, setTab] = useState<Tab>('brief');

  return (
    <aside className="side-pane">
      <nav className="tabs">
        <button className={tab === 'brief' ? 'on' : ''} onClick={() => setTab('brief')}>
          Work order
        </button>
        <button className={tab === 'isa' ? 'on' : ''} onClick={() => setTab('isa')}>
          ISA
        </button>
        <button className={tab === 'codex' ? 'on' : ''} onClick={() => setTab('codex')}>
          Codex
        </button>
      </nav>
      <div className="side-body">
        {tab === 'brief' && <Brief />}
        {tab === 'isa' && <IsaReference />}
        {tab === 'codex' && <GlossaryPanel />}
      </div>
    </aside>
  );
}

function Brief() {
  const level = useGame((s) => s.level);
  const hintsOpen = useGame((s) => s.hintsOpen);
  const openHint = useGame((s) => s.openHint);
  const failures = useGame((s) => s.failures);
  const solutionShown = useGame((s) => s.solutionShown);
  const showSolution = useGame((s) => s.showSolution);
  const loadReference = useGame((s) => s.loadReference);
  const loadStarter = useGame((s) => s.loadStarter);

  const canReveal = solutionShown || hintsOpen >= level.hints.length || failures >= REVEAL_AFTER_FAILURES;

  return (
    <div className="brief">
      <h1>
        <span className="level-num">{level.id}</span>
        {level.title}
      </h1>
      <p className="ticket">{level.ticket}</p>

      {level.brief.map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}

      <h3>Routing policy</h3>
      <ol className="rules">
        {level.rules.map((rule, i) => (
          <li key={i}>{rule}</li>
        ))}
      </ol>

      <h3>Provisioned slices</h3>
      <ul className="bin-legend">
        {level.bins.map((bin) => (
          <li key={bin} className={`bin-${bin.toLowerCase()}`}>
            <b>{BIN_LABEL[bin]}</b>
            <span>{BIN_BLURB[bin]}</span>
          </li>
        ))}
      </ul>

      <h3>Hints</h3>
      <div className="hints">
        {level.hints.slice(0, hintsOpen).map((hint, i) => (
          <p key={i} className="hint">
            <span>{i + 1}</span>
            {hint}
          </p>
        ))}
        {hintsOpen < level.hints.length && (
          <button className="btn btn-quiet" onClick={openHint}>
            Open hint {hintsOpen + 1} of {level.hints.length}
          </button>
        )}
      </div>

      <div className="brief-actions">
        <button className="btn btn-quiet" onClick={loadStarter}>
          Reset editor to scaffold
        </button>
        {!solutionShown && canReveal && (
          <button className="btn btn-quiet btn-danger" onClick={showSolution}>
            Reveal reference solution
          </button>
        )}
        {!canReveal && (
          <p className="locked-note">
            The reference solution unlocks after all hints are open, or after{' '}
            {REVEAL_AFTER_FAILURES} failed runs.
          </p>
        )}
        {solutionShown && (
          <>
            <pre className="reference">{level.reference}</pre>
            <button className="btn btn-quiet" onClick={loadReference}>
              Load it into the editor
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function IsaReference() {
  const level = useGame((s) => s.level);
  const available = new Set(opsForTier(level.tier));
  const grouped = opsByCategory(available);

  return (
    <div className="isa">
      <p className="isa-intro">
        Everything unlocked so far. Later work orders widen the machine; nothing is ever taken
        away.
      </p>
      {(Object.keys(CATEGORY_TITLES) as OpCategory[]).map((category) =>
        grouped[category].length === 0 ? null : (
          <section key={category}>
            <h3>{CATEGORY_TITLES[category]}</h3>
            {grouped[category].map((op) => (
              <div key={op.mnemonic} className="op">
                <code className="op-syntax">{op.syntax}</code>
                <p>{op.detail}</p>
                <span className="op-meta">
                  {op.cycles} cycle{op.cycles === 1 ? '' : 's'}
                  {op.setsFlags ? ' · sets Z/L' : ''}
                </span>
              </div>
            ))}
          </section>
        ),
      )}
      <section>
        <h3>Machine</h3>
        <p className="isa-note">
          8 registers R0–R7, 32-bit unsigned, wrapping. 16 RAM cells. One packet buffer. Two
          flags: Z (equal or zero) and L (unsigned less-than). Bin indices are fixed: 0 eMBB, 1
          URLLC, 2 mMTC, 3 V2X, 4 DROP.
        </p>
      </section>
    </div>
  );
}
