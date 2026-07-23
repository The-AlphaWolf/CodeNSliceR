import { useEffect } from 'react';
import { SPEED_LABELS, SPEEDS, useGame } from '@/state/store';

/** Transport controls for the debugger, plus the keyboard shortcuts that drive them. */
export function Controls() {
  const running = useGame((s) => s.running);
  const speedIndex = useGame((s) => s.speedIndex);
  const program = useGame((s) => s.program);
  const vmState = useGame((s) => s.vmState);
  const breakpoints = useGame((s) => s.breakpoints);
  const notice = useGame((s) => s.notice);
  const toggleRun = useGame((s) => s.toggleRun);
  const step = useGame((s) => s.step);
  const stepBack = useGame((s) => s.stepBack);
  const reset = useGame((s) => s.reset);
  const setSpeed = useGame((s) => s.setSpeed);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        useGame.getState().toggleRun();
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (e.shiftKey) useGame.getState().stepBack();
        else useGame.getState().step();
      } else if (e.key === 'F8') {
        e.preventDefault();
        useGame.getState().reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const errors = program.diagnostics.filter((d) => d.severity === 'error');

  return (
    <div className="controls">
      <div className="control-buttons">
        <button className="btn btn-primary" onClick={toggleRun} title="Ctrl+Enter">
          {running ? '❚❚ Pause' : '▶ Run'}
        </button>
        <button className="btn" onClick={step} title="F10" disabled={vmState.halted}>
          ▶| Step
        </button>
        <button className="btn" onClick={stepBack} title="Shift+F10">
          |◀ Back
        </button>
        <button className="btn" onClick={reset} title="F8">
          ⟲ Reset
        </button>

        <label className="speed">
          <span>speed</span>
          <input
            type="range"
            min={0}
            max={SPEEDS.length - 1}
            step={1}
            value={speedIndex}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
          <b>{SPEED_LABELS[speedIndex]}</b>
        </label>
      </div>

      <div className="status-bar">
        {errors.length > 0 ? (
          <span className="status status-bad">
            {errors.length} assembler error{errors.length === 1 ? '' : 's'} — line {errors[0].line}:{' '}
            {errors[0].message}
          </span>
        ) : vmState.fault ? (
          <span className="status status-bad">
            fault on line {vmState.faultLine}: {vmState.fault}
          </span>
        ) : notice ? (
          <span className="status status-note">{notice}</span>
        ) : (
          <span className="status status-ok">
            {program.instrs.length} instruction{program.instrs.length === 1 ? '' : 's'} assembled
            {breakpoints.length > 0 && ` · ${breakpoints.length} breakpoint${breakpoints.length === 1 ? '' : 's'}`}
            {vmState.halted && ' · halted'}
          </span>
        )}
      </div>
    </div>
  );
}
