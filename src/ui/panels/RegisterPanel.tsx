import { useGame } from '@/state/store';
import { hex32 } from '@/vm/packets';

/** Register file, flags and the two scores, with changed values flagged. */
export function RegisterPanel() {
  const vmState = useGame((s) => s.vmState);
  const program = useGame((s) => s.program);
  const par = useGame((s) => s.level.par);
  const touched = new Set(vmState.touchedRegs);

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Registers</h2>
        <span className="panel-note">32-bit unsigned</span>
      </header>

      <div className="reg-grid">
        {vmState.regs.map((value, i) => (
          <div key={i} className={`reg${touched.has(i) ? ' reg-hot' : ''}`}>
            <span className="reg-name">R{i}</span>
            <span className="reg-hex">{hex32(value)}</span>
            <span className="reg-dec">{value}</span>
          </div>
        ))}
      </div>

      <div className="flag-row">
        <span className={`flag${vmState.z ? ' flag-on' : ''}`} title="Set when the last compare matched or the last ALU result was zero">
          Z
        </span>
        <span className={`flag${vmState.l ? ' flag-on' : ''}`} title="Set when the last compare found the left side smaller">
          L
        </span>
        <span className="stat">
          PC <b>{vmState.pc}</b>
        </span>
        <span className="stat">
          size <b>{program.instrs.length}</b>
          <em>/{par.size}</em>
        </span>
        <span className="stat">
          cycles <b>{vmState.cycles}</b>
          <em>/{par.speed}</em>
        </span>
      </div>
    </section>
  );
}
