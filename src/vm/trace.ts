/**
 * Step-back support: a bounded ring buffer of VM snapshots.
 *
 * The machine state is tiny (8 registers + 16 RAM cells + a handful of counters and
 * id lists), so recording every step outright is cheaper and far simpler than trying
 * to invert instructions.
 */

import { CnVm, VmState } from './vm';

export const DEFAULT_HISTORY = 20_000;

export class Trace {
  private frames: VmState[] = [];

  constructor(private readonly limit: number = DEFAULT_HISTORY) {}

  get length(): number {
    return this.frames.length;
  }

  get canStepBack(): boolean {
    return this.frames.length > 0;
  }

  clear(): void {
    this.frames = [];
  }

  /** Records the state *before* an instruction runs. Call immediately before step(). */
  record(vm: CnVm): void {
    this.frames.push(vm.snapshot());
    if (this.frames.length > this.limit) this.frames.shift();
  }

  /** Rewinds one instruction. Returns false when no history remains. */
  stepBack(vm: CnVm): boolean {
    const frame = this.frames.pop();
    if (!frame) return false;
    vm.restore(frame);
    return true;
  }
}
