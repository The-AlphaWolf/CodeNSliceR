import { LEVELS } from '@/levels';
import { useGame } from '@/state/store';
import { revealLine } from './EditorPane';

/** Pass/fail report with par badges and a pointer at the first thing that went wrong. */
export function ResultModal() {
  const result = useGame((s) => s.result);
  const level = useGame((s) => s.level);
  const dismiss = useGame((s) => s.dismissResult);
  const selectLevel = useGame((s) => s.selectLevel);

  if (!result) return null;

  const nextLevel = LEVELS[LEVELS.findIndex((l) => l.id === level.id) + 1];
  const sizeBeat = result.size < level.par.size;
  const speedBeat = result.cycles < level.par.speed;

  return (
    <div className="modal-scrim" onClick={dismiss}>
      <div
        className={`modal ${result.passed ? 'modal-pass' : 'modal-fail'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2>{result.passed ? 'Work order closed' : 'Work order rejected'}</h2>
          <span className="panel-note">
            {level.id} · {level.title}
          </span>
        </header>

        <p className="result-message">{result.message}</p>

        {result.passed && (
          <div className="score-row">
            <div className={`score${sizeBeat ? ' score-gold' : ''}`}>
              <span>size</span>
              <b>{result.size}</b>
              <em>par {level.par.size}</em>
            </div>
            <div className={`score${speedBeat ? ' score-gold' : ''}`}>
              <span>cycles</span>
              <b>{result.cycles}</b>
              <em>par {level.par.speed}</em>
            </div>
          </div>
        )}

        {result.passed && (sizeBeat || speedBeat) && (
          <p className="brag">
            Under par on {sizeBeat && speedBeat ? 'both counts' : sizeBeat ? 'size' : 'speed'}.
          </p>
        )}

        {!result.passed && result.misrouted.length > 0 && (
          <table className="misroute-table">
            <thead>
              <tr>
                <th>packet</th>
                <th>went to</th>
                <th>should be</th>
                <th>traffic</th>
              </tr>
            </thead>
            <tbody>
              {result.misrouted.slice(0, 8).map((m) => (
                <tr key={m.id}>
                  <td>#{m.id}</td>
                  <td className="bad">{m.actual ?? 'nowhere'}</td>
                  <td className="good">{m.expected}</td>
                  <td className="dim">{level.packets.find((p) => p.id === m.id)?.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <footer className="modal-foot">
          {result.faultLine && (
            <button
              className="btn btn-quiet"
              onClick={() => {
                revealLine(result.faultLine!);
                dismiss();
              }}
            >
              Go to line {result.faultLine}
            </button>
          )}
          <button className="btn" onClick={dismiss}>
            {result.passed ? 'Stay here' : 'Back to the code'}
          </button>
          {result.passed && nextLevel && (
            <button
              className="btn btn-primary"
              onClick={() => {
                selectLevel(nextLevel.id);
              }}
            >
              Next: {nextLevel.title} →
            </button>
          )}
          {result.passed && !nextLevel && <span className="brag">Campaign complete.</span>}
        </footer>
      </div>
    </div>
  );
}
