/**
 * The CN-VM instruction set.
 *
 * One table drives the assembler's arity/type checking, the cycle accounting, the
 * Monaco hover docs and completions, and the in-game ISA reference panel.
 */

export type OperandKind =
  /** A register: R0..R7 */
  | 'reg'
  /** An immediate: #42, #0xFF, #0b1010, or a named constant */
  | 'imm'
  /** Either of the above */
  | 'regimm'
  /** A RAM reference: [4] or [R2] */
  | 'mem'
  /** A jump target label */
  | 'label'
  /** A slice bin name, e.g. SLICE_URLLC */
  | 'bin';

export type OpCategory = 'data' | 'packet' | 'alu' | 'control' | 'misc';

export interface OpDef {
  mnemonic: string;
  operands: OperandKind[];
  cycles: number;
  category: OpCategory;
  /** One-liner shown in completion lists. */
  summary: string;
  /** Longer prose for hover docs and the ISA reference panel. */
  detail: string;
  /** Canonical usage form, e.g. "SHR Rd, Rs|#imm". */
  syntax: string;
  example: string;
  /** True if the instruction can set the Z / L flags. */
  setsFlags?: boolean;
}

export const REGISTER_COUNT = 8;
export const RAM_SIZE = 16;
export const PACKET_WORDS = 2;
/** Hard ceiling so an infinite loop reports a fault instead of hanging the tab. */
export const CYCLE_LIMIT = 100_000;

const defs: OpDef[] = [
  // ----- data movement -----
  {
    mnemonic: 'MOV',
    operands: ['reg', 'regimm'],
    cycles: 1,
    category: 'data',
    summary: 'Copy a value into a register',
    detail: 'Copies the source register or immediate into the destination register. Flags unchanged.',
    syntax: 'MOV Rd, Rs|#imm',
    example: 'MOV R1, #0xFF',
  },
  {
    mnemonic: 'LOAD',
    operands: ['reg', 'mem'],
    cycles: 2,
    category: 'data',
    summary: 'Read a RAM cell into a register',
    detail:
      'Reads scratch RAM into Rd. The address may be a literal cell number, [3], or held in a register, [R2] — indirect addressing is what makes lookup tables possible.',
    syntax: 'LOAD Rd, [addr]|[Rs]',
    example: 'LOAD R4, [R2]',
  },
  {
    mnemonic: 'STORE',
    operands: ['mem', 'reg'],
    cycles: 2,
    category: 'data',
    summary: 'Write a register into a RAM cell',
    detail: 'Writes Rs into scratch RAM. Address may be literal or register-indirect.',
    syntax: 'STORE [addr]|[Rd], Rs',
    example: 'STORE [7], R0',
  },

  // ----- packet I/O -----
  {
    mnemonic: 'IN',
    operands: ['reg'],
    cycles: 1,
    category: 'packet',
    summary: 'Pull the next packet off the ingress queue',
    detail:
      'Pops the next packet into the packet buffer and copies its header word (word 0) into Rd. Faults if the ingress queue is empty — guard it with JEMPTY.',
    syntax: 'IN Rd',
    example: 'IN R0',
  },
  {
    mnemonic: 'GETW',
    operands: ['reg', 'imm'],
    cycles: 1,
    category: 'packet',
    summary: 'Read a word of the buffered packet',
    detail:
      'Copies a word of the packet currently in the buffer into Rd. #0 is the header word, #1 is the meta word (length, ARP, UE category, TEID).',
    syntax: 'GETW Rd, #0|#1',
    example: 'GETW R3, #1',
  },
  {
    mnemonic: 'EMIT',
    operands: ['bin'],
    cycles: 1,
    category: 'packet',
    summary: 'Send the buffered packet to a named slice',
    detail:
      'Moves the buffered packet into the named egress bin and empties the buffer. Faults if the buffer is empty or the bin is not provisioned on this level.',
    syntax: 'EMIT SLICE_x',
    example: 'EMIT SLICE_URLLC',
  },
  {
    mnemonic: 'EMITR',
    operands: ['reg'],
    cycles: 1,
    category: 'packet',
    summary: 'Send the buffered packet to the slice numbered in a register',
    detail:
      'Same as EMIT, but the destination bin is the index held in Rs. Bin indices are global and fixed: 0=SLICE_EMBB 1=SLICE_URLLC 2=SLICE_MMTC 3=SLICE_V2X 4=DROP. Pair it with a RAM lookup table to replace a whole ladder of compares.',
    syntax: 'EMITR Rs',
    example: 'EMITR R5',
  },
  {
    mnemonic: 'JEMPTY',
    operands: ['label'],
    cycles: 1,
    category: 'packet',
    summary: 'Jump if the ingress queue is drained',
    detail: 'Jumps to the label when no packets remain on the ingress queue. Does not touch flags.',
    syntax: 'JEMPTY label',
    example: 'JEMPTY done',
  },

  // ----- ALU -----
  {
    mnemonic: 'ADD',
    operands: ['reg', 'regimm'],
    cycles: 1,
    category: 'alu',
    summary: 'Rd = Rd + src',
    detail: 'Unsigned 32-bit add, wraps on overflow. Sets Z, clears L.',
    syntax: 'ADD Rd, Rs|#imm',
    example: 'ADD R2, #1',
    setsFlags: true,
  },
  {
    mnemonic: 'SUB',
    operands: ['reg', 'regimm'],
    cycles: 1,
    category: 'alu',
    summary: 'Rd = Rd - src',
    detail: 'Unsigned 32-bit subtract, wraps on underflow. Sets Z, clears L.',
    syntax: 'SUB Rd, Rs|#imm',
    example: 'SUB R2, R3',
    setsFlags: true,
  },
  {
    mnemonic: 'AND',
    operands: ['reg', 'regimm'],
    cycles: 1,
    category: 'alu',
    summary: 'Rd = Rd & src — the masking workhorse',
    detail:
      'Bitwise AND. Combined with a mask immediate this is how you isolate a field: AND R0, #0xFF keeps the low 8 bits and discards everything else. Sets Z, clears L.',
    syntax: 'AND Rd, Rs|#imm',
    example: 'AND R0, #0x3F',
    setsFlags: true,
  },
  {
    mnemonic: 'OR',
    operands: ['reg', 'regimm'],
    cycles: 1,
    category: 'alu',
    summary: 'Rd = Rd | src',
    detail: 'Bitwise OR — sets bits. Sets Z, clears L.',
    syntax: 'OR Rd, Rs|#imm',
    example: 'OR R1, #1',
    setsFlags: true,
  },
  {
    mnemonic: 'XOR',
    operands: ['reg', 'regimm'],
    cycles: 1,
    category: 'alu',
    summary: 'Rd = Rd ^ src',
    detail:
      'Bitwise XOR — flips bits. XOR Rd, Rd is the cheapest way to zero a register. Sets Z, clears L.',
    syntax: 'XOR Rd, Rs|#imm',
    example: 'XOR R0, R0',
    setsFlags: true,
  },
  {
    mnemonic: 'NOT',
    operands: ['reg'],
    cycles: 1,
    category: 'alu',
    summary: 'Rd = ~Rd',
    detail: 'Bitwise complement across all 32 bits. Sets Z, clears L.',
    syntax: 'NOT Rd',
    example: 'NOT R6',
    setsFlags: true,
  },
  {
    mnemonic: 'SHL',
    operands: ['reg', 'regimm'],
    cycles: 1,
    category: 'alu',
    summary: 'Rd = Rd << src',
    detail: 'Logical left shift. Bits shifted past bit 31 are lost. Shift counts are taken mod 32.',
    syntax: 'SHL Rd, Rs|#imm',
    example: 'SHL R1, #8',
    setsFlags: true,
  },
  {
    mnemonic: 'SHR',
    operands: ['reg', 'regimm'],
    cycles: 1,
    category: 'alu',
    summary: 'Rd = Rd >> src — slide a field down to bit 0',
    detail:
      'Logical right shift, zero-filled. Shift a field down to bit 0 first, then AND off the bits above it. Shift counts are taken mod 32.',
    syntax: 'SHR Rd, Rs|#imm',
    example: 'SHR R0, #24',
    setsFlags: true,
  },

  // ----- control -----
  {
    mnemonic: 'CMP',
    operands: ['reg', 'regimm'],
    cycles: 1,
    category: 'control',
    summary: 'Compare two values and set flags',
    detail:
      'Computes Ra - src without storing it. Sets Z when the two are equal and L when Ra is less than src (unsigned). Every conditional jump reads these two flags.',
    syntax: 'CMP Ra, Rb|#imm',
    example: 'CMP R1, #2',
    setsFlags: true,
  },
  {
    mnemonic: 'JMP',
    operands: ['label'],
    cycles: 1,
    category: 'control',
    summary: 'Unconditional jump',
    detail: 'Sets the program counter to the label.',
    syntax: 'JMP label',
    example: 'JMP loop',
  },
  {
    mnemonic: 'JZ',
    operands: ['label'],
    cycles: 1,
    category: 'control',
    summary: 'Jump if equal / zero (Z set)',
    detail: 'Taken when the last flag-setting instruction produced zero, or compared equal.',
    syntax: 'JZ label',
    example: 'JZ is_urllc',
  },
  {
    mnemonic: 'JNZ',
    operands: ['label'],
    cycles: 1,
    category: 'control',
    summary: 'Jump if not equal / non-zero (Z clear)',
    detail: 'Taken when the last flag-setting instruction produced a non-zero result.',
    syntax: 'JNZ label',
    example: 'JNZ next_rule',
  },
  {
    mnemonic: 'JLT',
    operands: ['label'],
    cycles: 1,
    category: 'control',
    summary: 'Jump if less than (L set)',
    detail: 'Unsigned less-than, from the most recent CMP.',
    syntax: 'JLT label',
    example: 'JLT low_qi',
  },
  {
    mnemonic: 'JGE',
    operands: ['label'],
    cycles: 1,
    category: 'control',
    summary: 'Jump if greater or equal (L clear)',
    detail: 'Unsigned greater-or-equal, from the most recent CMP.',
    syntax: 'JGE label',
    example: 'JGE high_qi',
  },
  {
    mnemonic: 'JGT',
    operands: ['label'],
    cycles: 1,
    category: 'control',
    summary: 'Jump if greater than (L and Z both clear)',
    detail: 'Unsigned greater-than, from the most recent CMP.',
    syntax: 'JGT label',
    example: 'JGT oversized',
  },
  {
    mnemonic: 'JLE',
    operands: ['label'],
    cycles: 1,
    category: 'control',
    summary: 'Jump if less or equal (L or Z set)',
    detail: 'Unsigned less-or-equal, from the most recent CMP.',
    syntax: 'JLE label',
    example: 'JLE within_mtu',
  },

  // ----- misc -----
  {
    mnemonic: 'NOP',
    operands: [],
    cycles: 1,
    category: 'misc',
    summary: 'Do nothing for one cycle',
    detail: 'Burns a cycle. Occasionally useful as a breakpoint anchor.',
    syntax: 'NOP',
    example: 'NOP',
  },
  {
    mnemonic: 'HALT',
    operands: [],
    cycles: 1,
    category: 'misc',
    summary: 'Stop the program',
    detail:
      'Ends the run immediately and grades the result. Falling off the end of the program does the same thing.',
    syntax: 'HALT',
    example: 'HALT',
  },
];

export const OPS: Record<string, OpDef> = Object.fromEntries(defs.map((d) => [d.mnemonic, d]));

export const MNEMONICS: string[] = defs.map((d) => d.mnemonic);

export type Mnemonic = string;

/** Ops available from level 1 onwards; levels widen this set as they unlock features. */
export const CORE_OPS: Mnemonic[] = ['IN', 'EMIT', 'JEMPTY', 'JMP', 'NOP', 'HALT'];

export function opsByCategory(available: Set<string>): Record<OpCategory, OpDef[]> {
  const out: Record<OpCategory, OpDef[]> = {
    data: [],
    packet: [],
    alu: [],
    control: [],
    misc: [],
  };
  for (const d of defs) if (available.has(d.mnemonic)) out[d.category].push(d);
  return out;
}
