import { useGame } from '@/state/store';
import { BIN_BLURB, BIN_INDEX, BIN_LABEL } from '@/vm/packets';

/** Ingress on the left, one column per provisioned slice on the right. */
export function QueuePanel() {
  const level = useGame((s) => s.level);
  const vmState = useGame((s) => s.vmState);
  const result = useGame((s) => s.result);

  const pending = level.packets.slice(vmState.ingressPos);
  const misrouted = new Set(result?.misrouted.map((m) => m.id) ?? []);

  return (
    <section className="panel panel-grow">
      <header className="panel-head">
        <h2>Traffic</h2>
        <span className="panel-note">
          {level.packets.length - pending.length}/{level.packets.length} pulled
        </span>
      </header>

      <div className="queues">
        <div className="queue ingress">
          <div className="queue-head">
            <span>INGRESS</span>
            <b>{pending.length}</b>
          </div>
          <ul className="chip-list">
            {pending.map((p, i) => (
              <li key={p.id} className={`chip${i === 0 ? ' chip-next' : ''}`} title={p.note}>
                #{p.id}
              </li>
            ))}
            {pending.length === 0 && <li className="chip chip-empty">drained</li>}
          </ul>
        </div>

        <div className="egress">
          {level.bins.map((bin) => {
            const ids = vmState.bins[BIN_INDEX[bin]];
            const expected = level.packets.filter((p) => p.expect === bin).length;
            return (
              <div key={bin} className={`queue bin bin-${bin.toLowerCase()}`} title={BIN_BLURB[bin]}>
                <div className="queue-head">
                  <span>{BIN_LABEL[bin]}</span>
                  <b>
                    {ids.length}
                    <em>/{expected}</em>
                  </b>
                </div>
                <ul className="chip-list">
                  {ids.map((id) => (
                    <li key={id} className={`chip${misrouted.has(id) ? ' chip-bad' : ''}`}>
                      #{id}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {vmState.buffer && (
        <p className="buffer-note">
          packet #{vmState.buffer.id} is held in the buffer, waiting on an EMIT
        </p>
      )}
    </section>
  );
}
