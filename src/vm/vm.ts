/**
 * CN-VM — the little register machine the player programs.
 *
 * Execution is strictly one instruction per `step()` so the UI can drive it at any
 * speed, and the whole machine state is small enough to snapshot every step, which
 * is what makes step-backwards debugging possible.
 */

import { RuntimeFault } from './diagnostics';
import { CYCLE_LIMIT, RAM_SIZE, REGISTER_COUNT } from './isa';
import { Instr, Operand, Program } from './assembler';
import { BINS, BinName, BIN_INDEX, u32 } from './packets';

export interface Packet {
  id: number;
  words: [number, number];
}

export interface VmState {
  regs: number[];
  ram: number[];
  pc: number;
  z: boolean;
  l: boolean;
  cycles: number;
  /** How many packets have been pulled off ingress. */
  ingressPos: number;
  /** The packet held by IN and not yet emitted. */
  buffer: Packet | null;
  /** Packet ids per global bin index, in emission order. */
  bins: number[][];
  halted: boolean;
  fault: string | null;
  faultLine: number | null;
  /** Registers written by the last executed instruction, for change highlighting. */
  touchedRegs: number[];
  touchedRam: number[];
}

export interface VmConfig {
  packets: Packet[];
  /** Bins this level provisions. Emitting anywhere else is a fault. */
  provisionedBins: BinName[];
  cycleLimit?: number;
}

export class CnVm {
  readonly program: Program;
  readonly packets: Packet[];
  readonly provisioned: Set<number>;
  readonly cycleLimit: number;
  state: VmState;

  constructor(program: Program, config: VmConfig) {
    this.program = program;
    this.packets = config.packets;
    this.provisioned = new Set(config.provisionedBins.map((b) => BIN_INDEX[b]));
    this.cycleLimit = config.cycleLimit ?? CYCLE_LIMIT;
    this.state = CnVm.freshState();
  }

  static freshState(): VmState {
    return {
      regs: new Array(REGISTER_COUNT).fill(0),
      ram: new Array(RAM_SIZE).fill(0),
      pc: 0,
      z: false,
      l: false,
      cycles: 0,
      ingressPos: 0,
      buffer: null,
      bins: BINS.map(() => []),
      halted: false,
      fault: null,
      faultLine: null,
      touchedRegs: [],
      touchedRam: [],
    };
  }

  reset(): void {
    this.state = CnVm.freshState();
  }

  snapshot(): VmState {
    const s = this.state;
    return {
      regs: s.regs.slice(),
      ram: s.ram.slice(),
      pc: s.pc,
      z: s.z,
      l: s.l,
      cycles: s.cycles,
      ingressPos: s.ingressPos,
      buffer: s.buffer ? { id: s.buffer.id, words: [...s.buffer.words] } : null,
      bins: s.bins.map((b) => b.slice()),
      halted: s.halted,
      fault: s.fault,
      faultLine: s.faultLine,
      touchedRegs: s.touchedRegs.slice(),
      touchedRam: s.touchedRam.slice(),
    };
  }

  restore(snap: VmState): void {
    this.state = {
      ...snap,
      regs: snap.regs.slice(),
      ram: snap.ram.slice(),
      bins: snap.bins.map((b) => b.slice()),
      buffer: snap.buffer ? { id: snap.buffer.id, words: [...snap.buffer.words] } : null,
      touchedRegs: snap.touchedRegs.slice(),
      touchedRam: snap.touchedRam.slice(),
    };
  }

  get done(): boolean {
    return this.state.halted;
  }

  /** Source line of the instruction that will execute next, or null at the end. */
  currentLine(): number | null {
    const instr = this.program.instrs[this.state.pc];
    return instr ? instr.line : null;
  }

  /** Executes one instruction. Safe to call on a halted machine (it does nothing). */
  step(): void {
    const s = this.state;
    if (s.halted) return;

    const instr = this.program.instrs[s.pc];
    if (!instr) {
      // Ran off the end of the program — same as HALT.
      s.halted = true;
      return;
    }

    s.touchedRegs = [];
    s.touchedRam = [];

    try {
      this.exec(instr);
    } catch (e) {
      if (e instanceof RuntimeFault) {
        s.fault = e.message;
        s.faultLine = e.line;
        s.halted = true;
        return;
      }
      throw e;
    }

    s.cycles += instr.cycles;
    if (s.cycles > this.cycleLimit) {
      s.fault = `execution limit exceeded (${this.cycleLimit} cycles) — the program is probably looping forever`;
      s.faultLine = instr.line;
      s.halted = true;
    }
  }

  /** Runs to completion. Returns the number of instructions retired. */
  run(maxSteps = CYCLE_LIMIT): number {
    let steps = 0;
    while (!this.state.halted && steps < maxSteps) {
      this.step();
      steps++;
    }
    if (!this.state.halted) {
      this.state.fault = `execution limit exceeded (${maxSteps} steps)`;
      this.state.halted = true;
    }
    return steps;
  }

  // -------------------------------------------------------------------------
  // Instruction execution
  // -------------------------------------------------------------------------

  private exec(instr: Instr): void {
    const s = this.state;
    const advance = () => {
      s.pc += 1;
    };
    const jump = (target: number) => {
      s.pc = target;
    };

    switch (instr.op) {
      case 'MOV': {
        this.setReg(instr.a!.value, this.read(instr.b!, instr));
        advance();
        break;
      }
      case 'LOAD': {
        const addr = this.addrOf(instr.b!, instr);
        this.setReg(instr.a!.value, s.ram[addr]);
        advance();
        break;
      }
      case 'STORE': {
        const addr = this.addrOf(instr.a!, instr);
        s.ram[addr] = u32(s.regs[instr.b!.value]);
        s.touchedRam.push(addr);
        advance();
        break;
      }

      case 'IN': {
        if (s.ingressPos >= this.packets.length) {
          throw new RuntimeFault(
            'IN on an empty ingress queue — guard the pull with JEMPTY',
            instr.line,
            s.pc,
          );
        }
        if (s.buffer) {
          throw new RuntimeFault(
            `IN would overwrite packet #${s.buffer.id}, which has not been emitted yet`,
            instr.line,
            s.pc,
          );
        }
        const pkt = this.packets[s.ingressPos++];
        s.buffer = { id: pkt.id, words: [...pkt.words] };
        this.setReg(instr.a!.value, pkt.words[0]);
        advance();
        break;
      }
      case 'GETW': {
        const pkt = this.requireBuffer(instr);
        this.setReg(instr.a!.value, pkt.words[instr.b!.value]);
        advance();
        break;
      }
      case 'EMIT': {
        this.emitTo(instr.a!.value, instr);
        advance();
        break;
      }
      case 'EMITR': {
        this.emitTo(s.regs[instr.a!.value], instr);
        advance();
        break;
      }
      case 'JEMPTY': {
        if (s.ingressPos >= this.packets.length) jump(instr.a!.value);
        else advance();
        break;
      }

      case 'ADD':
        this.alu(instr, (a, b) => u32(a + b));
        advance();
        break;
      case 'SUB':
        this.alu(instr, (a, b) => u32(a - b));
        advance();
        break;
      case 'AND':
        this.alu(instr, (a, b) => u32(a & b));
        advance();
        break;
      case 'OR':
        this.alu(instr, (a, b) => u32(a | b));
        advance();
        break;
      case 'XOR':
        this.alu(instr, (a, b) => u32(a ^ b));
        advance();
        break;
      case 'SHL':
        this.alu(instr, (a, b) => u32(a << (b & 31)));
        advance();
        break;
      case 'SHR':
        this.alu(instr, (a, b) => u32(a >>> (b & 31)));
        advance();
        break;
      case 'NOT': {
        const v = u32(~s.regs[instr.a!.value]);
        this.setReg(instr.a!.value, v);
        s.z = v === 0;
        s.l = false;
        advance();
        break;
      }

      case 'CMP': {
        const a = s.regs[instr.a!.value];
        const b = this.read(instr.b!, instr);
        s.z = a === b;
        s.l = a < b;
        advance();
        break;
      }
      case 'JMP':
        jump(instr.a!.value);
        break;
      case 'JZ':
        s.z ? jump(instr.a!.value) : advance();
        break;
      case 'JNZ':
        !s.z ? jump(instr.a!.value) : advance();
        break;
      case 'JLT':
        s.l ? jump(instr.a!.value) : advance();
        break;
      case 'JGE':
        !s.l ? jump(instr.a!.value) : advance();
        break;
      case 'JGT':
        !s.l && !s.z ? jump(instr.a!.value) : advance();
        break;
      case 'JLE':
        s.l || s.z ? jump(instr.a!.value) : advance();
        break;

      case 'NOP':
        advance();
        break;
      case 'HALT':
        s.halted = true;
        break;

      default:
        throw new RuntimeFault(`instruction ${instr.op} is not implemented`, instr.line, s.pc);
    }
  }

  private alu(instr: Instr, fn: (a: number, b: number) => number): void {
    const s = this.state;
    const result = fn(s.regs[instr.a!.value], this.read(instr.b!, instr));
    this.setReg(instr.a!.value, result);
    s.z = result === 0;
    s.l = false;
  }

  private setReg(index: number, value: number): void {
    this.state.regs[index] = u32(value);
    this.state.touchedRegs.push(index);
  }

  private read(operand: Operand, instr: Instr): number {
    if (operand.type === 'reg') return this.state.regs[operand.value];
    if (operand.type === 'imm') return u32(operand.value);
    throw new RuntimeFault(`${instr.op}: cannot read operand "${operand.text}"`, instr.line, this.state.pc);
  }

  private addrOf(operand: Operand, instr: Instr): number {
    const addr =
      operand.type === 'mem-reg' ? this.state.regs[operand.value] : u32(operand.value);
    if (addr >= RAM_SIZE) {
      throw new RuntimeFault(
        `RAM address ${addr} is out of range — this machine has cells 0..${RAM_SIZE - 1}`,
        instr.line,
        this.state.pc,
      );
    }
    return addr;
  }

  private requireBuffer(instr: Instr): Packet {
    const pkt = this.state.buffer;
    if (!pkt) {
      throw new RuntimeFault(
        `${instr.op} needs a packet in the buffer — pull one with IN first`,
        instr.line,
        this.state.pc,
      );
    }
    return pkt;
  }

  private emitTo(binIndex: number, instr: Instr): void {
    const s = this.state;
    const pkt = this.requireBuffer(instr);
    if (binIndex >= BINS.length) {
      throw new RuntimeFault(
        `bin index ${binIndex} does not exist — valid indices are 0..${BINS.length - 1}`,
        instr.line,
        s.pc,
      );
    }
    if (!this.provisioned.has(binIndex)) {
      throw new RuntimeFault(
        `${BINS[binIndex]} is not provisioned on this level`,
        instr.line,
        s.pc,
      );
    }
    s.bins[binIndex].push(pkt.id);
    s.buffer = null;
  }
}
