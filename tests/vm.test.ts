import { describe, expect, it } from 'vitest';
import { assemble } from '@/vm/assembler';
import { CnVm, Packet } from '@/vm/vm';
import { Trace } from '@/vm/trace';
import { binOf } from '@/vm/grade';
import { encodeHeader, encodeMeta } from '@/vm/packets';

function packet(id: number, header = encodeHeader({ SST: 1 }), meta = encodeMeta()): Packet {
  return { id, words: [header, meta] };
}

function machine(source: string, packets: Packet[] = []) {
  const program = assemble(source);
  expect(program.diagnostics).toEqual([]);
  return new CnVm(program, {
    packets,
    provisionedBins: ['SLICE_EMBB', 'SLICE_URLLC', 'SLICE_MMTC', 'SLICE_V2X', 'DROP'],
  });
}

function runRegs(source: string): number[] {
  const vm = machine(source);
  vm.run();
  expect(vm.state.fault).toBeNull();
  return vm.state.regs;
}

describe('ALU', () => {
  it('computes each operation over unsigned 32-bit values', () => {
    const regs = runRegs(`
  MOV R0, #0xF0
  AND R0, #0x3C
  MOV R1, #0xF0
  OR R1, #0x0F
  MOV R2, #0xFF
  XOR R2, #0x0F
  MOV R3, #1
  SHL R3, #31
  MOV R4, #0x80000000
  SHR R4, #31
  MOV R5, #0
  NOT R5
  MOV R6, #10
  SUB R6, #4
  MOV R7, #10
  ADD R7, #4
`);
    expect(regs[0]).toBe(0x30);
    expect(regs[1]).toBe(0xff);
    expect(regs[2]).toBe(0xf0);
    expect(regs[3]).toBe(0x80000000);
    expect(regs[4]).toBe(1);
    expect(regs[5]).toBe(0xffffffff);
    expect(regs[6]).toBe(6);
    expect(regs[7]).toBe(14);
  });

  it('wraps rather than going negative or exceeding 32 bits', () => {
    const regs = runRegs(`
  MOV R0, #0
  SUB R0, #1
  MOV R1, #0xFFFFFFFF
  ADD R1, #2
`);
    expect(regs[0]).toBe(0xffffffff);
    expect(regs[1]).toBe(1);
  });

  it('takes shift counts modulo 32', () => {
    const regs = runRegs('MOV R0, #1\n  SHL R0, #32');
    expect(regs[0]).toBe(1);
  });

  it('sets Z from its own result so a bare JZ works', () => {
    const regs = runRegs(`
  MOV R0, #0b1000
  AND R0, #1
  JZ zero
  MOV R1, #99
  JMP end
zero:
  MOV R1, #7
end:
`);
    expect(regs[1]).toBe(7);
  });
});

describe('flags and branching', () => {
  const ladder = (a: number, b: number) => `
  MOV R0, #${a}
  CMP R0, #${b}
  MOV R1, #0
  JLT lt
  JGT gt
  MOV R1, #2
  JMP end
lt:
  MOV R1, #1
  JMP end
gt:
  MOV R1, #3
end:
`;

  it('orders unsigned comparisons correctly', () => {
    expect(runRegs(ladder(1, 2))[1]).toBe(1);
    expect(runRegs(ladder(2, 2))[1]).toBe(2);
    expect(runRegs(ladder(3, 2))[1]).toBe(3);
  });

  it('treats the high bit as large, not negative', () => {
    expect(runRegs(ladder(0x80000000, 1))[1]).toBe(3);
  });

  it('resolves JLE and JGE at the boundary', () => {
    const regs = runRegs(`
  MOV R0, #9
  CMP R0, #9
  JLE le
  MOV R1, #0
  JMP next
le:
  MOV R1, #1
next:
  CMP R0, #9
  JGE ge
  MOV R2, #0
  JMP end
ge:
  MOV R2, #1
end:
`);
    expect(regs[1]).toBe(1);
    expect(regs[2]).toBe(1);
  });
});

describe('RAM', () => {
  it('round-trips through direct and indirect addressing', () => {
    const regs = runRegs(`
  MOV R0, #123
  STORE [5], R0
  MOV R1, #5
  LOAD R2, [R1]
  MOV R3, #77
  STORE [R1], R3
  LOAD R4, [5]
`);
    expect(regs[2]).toBe(123);
    expect(regs[4]).toBe(77);
  });

  it('faults on an out-of-range indirect address', () => {
    const vm = machine('MOV R0, #99\n  LOAD R1, [R0]');
    vm.run();
    expect(vm.state.fault).toContain('out of range');
  });

  it('charges two cycles for a memory access', () => {
    const vm = machine('MOV R0, #1\n  STORE [0], R0\n  LOAD R1, [0]');
    vm.run();
    expect(vm.state.cycles).toBe(5);
  });
});

describe('packet I/O', () => {
  it('moves packets from ingress to bins', () => {
    const vm = machine(
      `
loop:
  JEMPTY done
  IN R0
  EMIT SLICE_EMBB
  JMP loop
done:
  HALT
`,
      [packet(1), packet(2)],
    );
    vm.run();
    expect(vm.state.fault).toBeNull();
    expect(binOf(vm.state, 1)).toBe('SLICE_EMBB');
    expect(binOf(vm.state, 2)).toBe('SLICE_EMBB');
    expect(vm.state.ingressPos).toBe(2);
  });

  it('reads the meta word with GETW', () => {
    const vm = machine('IN R0\n  GETW R1, #1\n  EMIT DROP', [
      packet(1, encodeHeader({ SST: 2 }), encodeMeta({ LEN: 1500, ARP: 3 })),
    ]);
    vm.run();
    expect(vm.state.regs[1] >>> 16).toBe(1500);
    expect((vm.state.regs[1] >>> 12) & 0xf).toBe(3);
  });

  it('routes by register index with EMITR', () => {
    const vm = machine('IN R0\n  MOV R1, #SLICE_V2X\n  EMITR R1', [packet(1)]);
    vm.run();
    expect(binOf(vm.state, 1)).toBe('SLICE_V2X');
  });

  it('faults when pulling from an empty queue', () => {
    const vm = machine('IN R0', []);
    vm.run();
    expect(vm.state.fault).toContain('empty ingress queue');
  });

  it('faults when a second IN would drop the buffered packet', () => {
    const vm = machine('IN R0\n  IN R1', [packet(1), packet(2)]);
    vm.run();
    expect(vm.state.fault).toContain('has not been emitted');
  });

  it('faults when emitting with nothing in the buffer', () => {
    const vm = machine('EMIT DROP', [packet(1)]);
    vm.run();
    expect(vm.state.fault).toContain('needs a packet');
  });

  it('faults when emitting to a bin the level did not provision', () => {
    const program = assemble('IN R0\n  EMIT SLICE_V2X');
    const vm = new CnVm(program, { packets: [packet(1)], provisionedBins: ['SLICE_EMBB'] });
    vm.run();
    expect(vm.state.fault).toContain('not provisioned');
  });

  it('faults on a bin index that does not exist', () => {
    const vm = machine('IN R0\n  MOV R1, #9\n  EMITR R1', [packet(1)]);
    vm.run();
    expect(vm.state.fault).toContain('does not exist');
  });
});

describe('termination', () => {
  it('halts by running off the end of the program', () => {
    const vm = machine('NOP\n  NOP');
    vm.run();
    expect(vm.state.halted).toBe(true);
    expect(vm.state.fault).toBeNull();
  });

  it('reports a runaway loop instead of hanging', () => {
    const program = assemble('loop:\n  JMP loop');
    const vm = new CnVm(program, { packets: [], provisionedBins: [], cycleLimit: 500 });
    vm.run();
    expect(vm.state.fault).toContain('execution limit exceeded');
    expect(vm.state.cycles).toBeGreaterThan(500);
  });
});

describe('step-back', () => {
  it('restores registers, RAM, queues and flags exactly', () => {
    const vm = machine(
      `
loop:
  JEMPTY done
  IN R0
  MOV R1, #4
  STORE [2], R1
  EMIT SLICE_EMBB
  JMP loop
done:
  HALT
`,
      [packet(1), packet(2), packet(3)],
    );
    const trace = new Trace();
    const seen: string[] = [];

    while (!vm.done) {
      seen.push(JSON.stringify(vm.state));
      trace.record(vm);
      vm.step();
    }

    // Unwind the whole run and check every intermediate state matches on the way back.
    for (let i = seen.length - 1; i >= 0; i--) {
      expect(trace.stepBack(vm)).toBe(true);
      expect(JSON.stringify(vm.state)).toBe(seen[i]);
    }
    expect(trace.canStepBack).toBe(false);
    expect(trace.stepBack(vm)).toBe(false);
  });

  it('keeps snapshots independent of later mutation', () => {
    const vm = machine('MOV R0, #1\n  MOV R0, #2');
    const snap = vm.snapshot();
    vm.run();
    expect(snap.regs[0]).toBe(0);
    expect(vm.state.regs[0]).toBe(2);
  });
});
