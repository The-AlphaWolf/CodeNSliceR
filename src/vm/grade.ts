/**
 * Grading: did the program route every packet where the work order said it should?
 *
 * Membership only — the order packets land in a bin is not checked.
 */

import { BINS, BinName, BIN_INDEX } from './packets';
import { Packet, VmState } from './vm';

export interface MisroutedPacket {
  id: number;
  expected: BinName;
  /** Where it actually ended up, or null if it never left the machine. */
  actual: BinName | null;
}

export interface GradeResult {
  passed: boolean;
  /** Machine-level fault (bad address, infinite loop, ...). Beats every other failure. */
  fault: string | null;
  faultLine: number | null;
  misrouted: MisroutedPacket[];
  /** Packets still sitting on ingress or in the buffer when the program stopped. */
  unprocessed: number[];
  size: number;
  cycles: number;
  /** Human summary for the result modal. */
  message: string;
}

export interface GradeInput {
  packets: Packet[];
  /** packet id -> the bin the work order requires. */
  expected: Map<number, BinName>;
  state: VmState;
  /** Instruction count of the assembled program. */
  size: number;
}

export function grade({ packets, expected, state, size }: GradeInput): GradeResult {
  const actual = new Map<number, BinName>();
  state.bins.forEach((ids, binIndex) => {
    for (const id of ids) actual.set(id, BINS[binIndex]);
  });

  // A packet the program never reached is "unprocessed", not "misrouted" — reporting it
  // as both buries the real failure under noise.
  const unprocessed: number[] = [];
  for (let i = state.ingressPos; i < packets.length; i++) unprocessed.push(packets[i].id);
  if (state.buffer) unprocessed.push(state.buffer.id);
  const stalled = new Set(unprocessed);

  const misrouted: MisroutedPacket[] = [];
  for (const pkt of packets) {
    const want = expected.get(pkt.id);
    if (!want || stalled.has(pkt.id)) continue;
    const got = actual.get(pkt.id) ?? null;
    if (got !== want) misrouted.push({ id: pkt.id, expected: want, actual: got });
  }

  const passed = !state.fault && misrouted.length === 0 && unprocessed.length === 0;

  return {
    passed,
    fault: state.fault,
    faultLine: state.faultLine,
    misrouted,
    unprocessed,
    size,
    cycles: state.cycles,
    message: summarize(state, misrouted, unprocessed, passed),
  };
}

function summarize(
  state: VmState,
  misrouted: MisroutedPacket[],
  unprocessed: number[],
  passed: boolean,
): string {
  if (state.fault) return state.fault;
  if (passed) return 'All traffic classified correctly. Work order closed.';
  if (unprocessed.length > 0) {
    return `Program stopped with ${unprocessed.length} packet${unprocessed.length === 1 ? '' : 's'} still unrouted (#${unprocessed.join(', #')}).`;
  }
  const first = misrouted[0];
  const where = first.actual ? `landed in ${first.actual}` : 'was never emitted';
  return `Packet #${first.id} ${where}, but the work order requires ${first.expected}.${
    misrouted.length > 1 ? ` (${misrouted.length - 1} more misrouted)` : ''
  }`;
}

/** Convenience for tests and the CLI harness. */
export function binOf(state: VmState, packetId: number): BinName | null {
  for (const bin of BINS) {
    if (state.bins[BIN_INDEX[bin]].includes(packetId)) return bin;
  }
  return null;
}
