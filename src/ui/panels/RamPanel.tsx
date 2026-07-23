import { useGame } from '@/state/store';

/** The 16 scratch cells. Non-zero cells are lit so a table build is visible at a glance. */
export function RamPanel() {
  const vmState = useGame((s) => s.vmState);
  const tier = useGame((s) => s.level.tier);
  const touched = new Set(vmState.touchedRam);

  // RAM only becomes reachable once LOAD/STORE are unlocked.
  if (tier < 6) return null;

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Scratch RAM</h2>
        <span className="panel-note">16 cells</span>
      </header>
      <div className="ram-grid">
        {vmState.ram.map((value, i) => (
          <div
            key={i}
            className={`ram-cell${value !== 0 ? ' ram-set' : ''}${touched.has(i) ? ' ram-hot' : ''}`}
            title={`cell ${i}`}
          >
            <span className="ram-addr">{i}</span>
            <span className="ram-val">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
