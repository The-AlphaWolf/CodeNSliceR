/**
 * Game state. The VM instance itself lives in the store but is treated as opaque —
 * components render from `vmState`, a plain snapshot refreshed after every step, so
 * React never has to reason about a mutable machine.
 */

import { create } from 'zustand';
import { assemble, Program } from '@/vm/assembler';
import { CnVm, VmState } from '@/vm/vm';
import { GradeResult, grade } from '@/vm/grade';
import { Trace } from '@/vm/trace';
import { LEVELS, levelById } from '@/levels';
import { Level, expectationsOf, opsForTier } from '@/levels/schema';
import {
  Progress,
  emptyProgress,
  levelProgress,
  loadProgress,
  saveProgress,
} from './storage';

/** Instructions per second for each notch of the speed control. Infinity = as fast as possible. */
export const SPEEDS = [2, 6, 20, 80, Infinity];
export const SPEED_LABELS = ['0.5x', '1x', '4x', '16x', 'MAX'];

/** Failed runs before the reference solution can be revealed. */
export const REVEAL_AFTER_FAILURES = 4;

export interface GameState {
  level: Level;
  source: string;
  program: Program;
  vm: CnVm;
  trace: Trace;
  vmState: VmState;
  running: boolean;
  speedIndex: number;
  breakpoints: number[];
  result: GradeResult | null;
  failures: number;
  hintsOpen: number;
  solutionShown: boolean;
  progress: Progress;
  /** Bumped whenever a transient notice should appear in the status bar. */
  notice: string | null;

  selectLevel: (id: string) => void;
  setSource: (source: string) => void;
  toggleBreakpoint: (line: number) => void;
  reset: () => void;
  step: () => void;
  stepBack: () => void;
  toggleRun: () => void;
  setSpeed: (index: number) => void;
  openHint: () => void;
  showSolution: () => void;
  loadReference: () => void;
  loadStarter: () => void;
  dismissResult: () => void;
  setProgress: (progress: Progress) => void;
  setNotice: (notice: string | null) => void;
}

function build(level: Level, source: string): { program: Program; vm: CnVm } {
  const program = assemble(source, { allowedOps: opsForTier(level.tier) });
  const vm = new CnVm(program, { packets: level.packets, provisionedBins: level.bins });
  return { program, vm };
}

/**
 * Timer handle for the run loop. Kept outside the store — it is not render state.
 * A timer rather than requestAnimationFrame: rAF stops entirely in a background tab,
 * which would silently freeze a run the moment the player switches away.
 */
let timer: number | null = null;

function cancelLoop(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

export const useGame = create<GameState>((set, get) => {
  const initialProgress = typeof localStorage === 'undefined' ? emptyProgress() : loadProgress();
  const startLevel = levelById(initialProgress.lastLevel) ?? LEVELS[0];
  const saved = levelProgress(initialProgress, startLevel.id);
  const startSource = saved.source || startLevel.starter;
  const { program, vm } = build(startLevel, startSource);

  /** Runs one instruction and settles everything that depends on it. */
  function stepOnce(): { halted: boolean; atBreakpoint: boolean } {
    const { vm: machine, trace, breakpoints, level, program: prog } = get();
    if (machine.done) return { halted: true, atBreakpoint: false };

    trace.record(machine);
    machine.step();
    const state = machine.snapshot();
    set({ vmState: state });

    if (machine.done) {
      const result = grade({
        packets: level.packets,
        expected: expectationsOf(level),
        state,
        size: prog.instrs.length,
      });
      recordResult(result);
      return { halted: true, atBreakpoint: false };
    }

    const line = machine.currentLine();
    return { halted: false, atBreakpoint: line !== null && breakpoints.includes(line) };
  }

  function recordResult(result: GradeResult): void {
    const { level, source, progress } = get();
    const previous = levelProgress(progress, level.id);
    const next: Progress = {
      ...progress,
      lastLevel: level.id,
      levels: {
        ...progress.levels,
        [level.id]: {
          ...previous,
          source,
          solved: previous.solved || result.passed,
          bestSize: result.passed
            ? Math.min(previous.bestSize ?? Infinity, result.size)
            : previous.bestSize,
          bestSpeed: result.passed
            ? Math.min(previous.bestSpeed ?? Infinity, result.cycles)
            : previous.bestSpeed,
        },
      },
    };
    saveProgress(next);
    set({
      result,
      progress: next,
      running: false,
      failures: result.passed ? 0 : get().failures + 1,
    });
    cancelLoop();
  }

  /** Advances the machine, stopping on halt or on a breakpoint. Returns true when the run is over. */
  function advance(): boolean {
    const { halted, atBreakpoint } = stepOnce();
    if (halted) {
      cancelLoop();
      return true;
    }
    if (atBreakpoint) {
      cancelLoop();
      set({ running: false, notice: `Paused at breakpoint on line ${get().vm.currentLine()}` });
      return true;
    }
    return false;
  }

  function loop(): void {
    cancelLoop();
    const speed = SPEEDS[get().speedIndex];

    if (speed === Infinity) {
      // MAX runs to completion immediately rather than animating — the debugger view
      // is not useful at that rate anyway, and the breakpoint contract still holds.
      for (let i = 0; i < 1_000_000 && get().running; i++) {
        if (advance()) return;
      }
      cancelLoop();
      set({ running: false });
      return;
    }

    timer = setInterval(() => {
      if (!get().running) {
        cancelLoop();
        return;
      }
      advance();
    }, 1000 / speed) as unknown as number;
  }

  return {
    level: startLevel,
    source: startSource,
    program,
    vm,
    trace: new Trace(),
    vmState: vm.snapshot(),
    running: false,
    speedIndex: 2,
    breakpoints: [],
    result: null,
    failures: 0,
    hintsOpen: saved.hints,
    solutionShown: saved.revealed,
    progress: initialProgress,
    notice: null,

    selectLevel(id) {
      const level = levelById(id);
      if (!level) return;
      cancelLoop();
      const { progress } = get();
      const saved = levelProgress(progress, id);
      const source = saved.source || level.starter;
      const built = build(level, source);
      const next = { ...progress, lastLevel: id };
      saveProgress(next);
      set({
        level,
        source,
        program: built.program,
        vm: built.vm,
        trace: new Trace(),
        vmState: built.vm.snapshot(),
        running: false,
        breakpoints: [],
        result: null,
        failures: 0,
        hintsOpen: saved.hints,
        solutionShown: saved.revealed,
        progress: next,
        notice: null,
      });
    },

    setSource(source) {
      cancelLoop();
      const { level, progress } = get();
      const built = build(level, source);
      const previous = levelProgress(progress, level.id);
      const next: Progress = {
        ...progress,
        levels: { ...progress.levels, [level.id]: { ...previous, source } },
      };
      saveProgress(next);
      set({
        source,
        program: built.program,
        vm: built.vm,
        trace: new Trace(),
        vmState: built.vm.snapshot(),
        running: false,
        result: null,
        progress: next,
      });
    },

    toggleBreakpoint(line) {
      const { breakpoints } = get();
      set({
        breakpoints: breakpoints.includes(line)
          ? breakpoints.filter((l) => l !== line)
          : [...breakpoints, line].sort((a, b) => a - b),
      });
    },

    reset() {
      cancelLoop();
      const { level, source } = get();
      const built = build(level, source);
      set({
        program: built.program,
        vm: built.vm,
        trace: new Trace(),
        vmState: built.vm.snapshot(),
        running: false,
        result: null,
        notice: null,
      });
    },

    step() {
      const { program, running } = get();
      if (running) {
        cancelLoop();
        set({ running: false });
      }
      if (!program.ok) {
        set({ notice: 'Fix the assembler errors before running.' });
        return;
      }
      stepOnce();
    },

    stepBack() {
      const { vm: machine, trace, running } = get();
      if (running) {
        cancelLoop();
        set({ running: false });
      }
      if (!trace.stepBack(machine)) {
        set({ notice: 'Already at the start of the run.' });
        return;
      }
      set({ vmState: machine.snapshot(), result: null, notice: null });
    },

    toggleRun() {
      const { running, program } = get();
      if (running) {
        cancelLoop();
        set({ running: false });
        return;
      }
      if (!program.ok) {
        set({ notice: 'Fix the assembler errors before running.' });
        return;
      }
      if (program.instrs.length === 0) {
        set({ notice: 'Nothing to run — the program is empty.' });
        return;
      }
      if (get().vm.done) get().reset();
      set({ running: true, result: null, notice: null });
      loop();
    },

    setSpeed(index) {
      const wasRunning = get().running;
      cancelLoop();
      set({ speedIndex: index, running: false });
      if (wasRunning) {
        set({ running: true });
        loop();
      }
    },

    openHint() {
      const { level, hintsOpen, progress } = get();
      const next = Math.min(hintsOpen + 1, level.hints.length);
      const previous = levelProgress(progress, level.id);
      const nextProgress: Progress = {
        ...progress,
        levels: { ...progress.levels, [level.id]: { ...previous, hints: next } },
      };
      saveProgress(nextProgress);
      set({ hintsOpen: next, progress: nextProgress });
    },

    showSolution() {
      const { level, progress } = get();
      const previous = levelProgress(progress, level.id);
      const next: Progress = {
        ...progress,
        levels: { ...progress.levels, [level.id]: { ...previous, revealed: true } },
      };
      saveProgress(next);
      set({ solutionShown: true, progress: next });
    },

    loadReference() {
      get().setSource(get().level.reference);
      set({ notice: 'Reference solution loaded into the editor.' });
    },

    loadStarter() {
      get().setSource(get().level.starter);
      set({ notice: 'Editor reset to the work-order scaffold.' });
    },

    dismissResult() {
      set({ result: null });
    },

    setProgress(progress) {
      saveProgress(progress);
      set({ progress });
      const { level } = get();
      const saved = levelProgress(progress, level.id);
      if (saved.source) get().setSource(saved.source);
    },

    setNotice(notice) {
      set({ notice });
    },
  };
});
