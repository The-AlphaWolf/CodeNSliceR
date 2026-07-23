import { describe, expect, it } from 'vitest';
import { assemble } from '@/vm/assembler';
import { MNEMONICS } from '@/vm/isa';

function firstError(source: string, allowedOps?: string[]) {
  const p = assemble(source, allowedOps ? { allowedOps } : {});
  return p.diagnostics[0];
}

describe('lexing and layout', () => {
  it('ignores blank lines and comments', () => {
    const p = assemble(`
; a comment

  NOP   ; trailing comment
`);
    expect(p.ok).toBe(true);
    expect(p.instrs).toHaveLength(1);
    expect(p.instrs[0].line).toBe(4);
  });

  it('does not treat a semicolon inside a comment as code', () => {
    const p = assemble('NOP ; HALT HALT HALT');
    expect(p.instrs.map((i) => i.op)).toEqual(['NOP']);
  });

  it('reports columns that line up with the source', () => {
    const d = firstError('  MOV R9, #1');
    expect(d.line).toBe(1);
    expect(d.col).toBe(7);
    expect(d.message).toContain('R9');
  });
});

describe('labels', () => {
  it('resolves forward and backward references', () => {
    const p = assemble(`
top:
  JMP bottom
bottom:
  JMP top
`);
    expect(p.ok).toBe(true);
    expect(p.instrs[0].a!.value).toBe(1);
    expect(p.instrs[1].a!.value).toBe(0);
  });

  it('is case-insensitive on label names', () => {
    const p = assemble('Loop:\n  JMP loop');
    expect(p.ok).toBe(true);
    expect(p.instrs[0].a!.value).toBe(0);
  });

  it('accepts a label on the same line as its instruction', () => {
    const p = assemble('start: NOP\n  JMP start');
    expect(p.ok).toBe(true);
    expect(p.instrs).toHaveLength(2);
  });

  it('rejects duplicates', () => {
    expect(firstError('a:\n NOP\na:\n NOP').message).toContain('already defined');
  });

  it('rejects unknown targets', () => {
    expect(firstError('JMP nowhere').message).toContain('unknown label');
  });

  it('allows a trailing label pointing one past the last instruction', () => {
    const p = assemble('JMP done\ndone:');
    expect(p.ok).toBe(true);
    expect(p.instrs[0].a!.value).toBe(1);
  });
});

describe('operands', () => {
  it('parses decimal, hex and binary immediates', () => {
    const p = assemble('MOV R0, #42\nMOV R1, #0xFF\nMOV R2, #0b1010');
    expect(p.ok).toBe(true);
    expect(p.instrs.map((i) => i.b!.value)).toEqual([42, 255, 10]);
  });

  it('accepts named constants with or without the hash', () => {
    const p = assemble('MOV R0, #SLICE_URLLC\nMOV R1, SLICE_V2X\nMOV R2, #SST_MMTC');
    expect(p.ok).toBe(true);
    expect(p.instrs.map((i) => i.b!.value)).toEqual([1, 3, 3]);
  });

  it('parses direct and indirect RAM references', () => {
    const p = assemble('LOAD R0, [3]\nSTORE [R1], R2');
    expect(p.ok).toBe(true);
    expect(p.instrs[0].b!.type).toBe('mem-imm');
    expect(p.instrs[1].a!.type).toBe('mem-reg');
  });

  it('rejects RAM addresses past the end of memory', () => {
    expect(firstError('LOAD R0, [16]').message).toContain('out of range');
  });

  it('rejects a register where an immediate is required', () => {
    expect(firstError('GETW R0, R1').message).toContain('immediate');
  });

  it('rejects a packet word index the machine does not have', () => {
    expect(firstError('GETW R0, #2').message).toContain('2 words');
  });

  it('rejects bad arity in both directions', () => {
    expect(firstError('SHR R1, R2, R3').message).toContain('takes 2 operands');
    expect(firstError('MOV R1').message).toContain('takes 2 operands');
  });

  it('names the bins when EMIT gets something else', () => {
    const d = firstError('EMIT SLICE_TURBO');
    expect(d.message).toContain('SLICE_EMBB');
  });

  it('is case-insensitive on mnemonics and registers', () => {
    const p = assemble('mov r0, #1\n  shr R0, #1');
    expect(p.ok).toBe(true);
    expect(p.instrs.map((i) => i.op)).toEqual(['MOV', 'SHR']);
  });
});

describe('level instruction gating', () => {
  it('rejects instructions the level has not unlocked', () => {
    const d = firstError('ADD R0, #1', ['IN', 'EMIT', 'HALT']);
    expect(d.message).toContain('not available on this level');
  });

  it('allows everything when no restriction is given', () => {
    for (const m of MNEMONICS) {
      const p = assemble(`${m} ${sampleOperands(m)}`);
      expect(p.diagnostics.filter((d) => d.message.includes('not available'))).toHaveLength(0);
    }
  });
});

function sampleOperands(mnemonic: string): string {
  switch (mnemonic) {
    case 'MOV':
    case 'ADD':
    case 'SUB':
    case 'AND':
    case 'OR':
    case 'XOR':
    case 'SHL':
    case 'SHR':
    case 'CMP':
      return 'R0, #1';
    case 'LOAD':
      return 'R0, [0]';
    case 'STORE':
      return '[0], R0';
    case 'IN':
    case 'EMITR':
    case 'NOT':
      return 'R0';
    case 'GETW':
      return 'R0, #0';
    case 'EMIT':
      return 'DROP';
    default:
      return OPS_NEEDING_LABEL.has(mnemonic) ? 'here' : '';
  }
}

const OPS_NEEDING_LABEL = new Set([
  'JMP',
  'JZ',
  'JNZ',
  'JLT',
  'JGE',
  'JGT',
  'JLE',
  'JEMPTY',
]);
