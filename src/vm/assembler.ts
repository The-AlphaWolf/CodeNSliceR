/**
 * CN-SliceR assembler: source text -> executable Program.
 *
 * Deliberately single-pass-plus-fixup and fully non-throwing: every problem comes
 * back as a Diagnostic with line/column so Monaco can underline it. A program with
 * errors still returns whatever instructions parsed, so the UI can keep rendering.
 */

import { Diagnostic, err } from './diagnostics';
import { OPS, OperandKind, PACKET_WORDS, RAM_SIZE, REGISTER_COUNT } from './isa';
import { BINS, BinName, NAMED_CONSTANTS } from './packets';

export type OperandType = 'reg' | 'imm' | 'mem-imm' | 'mem-reg' | 'label' | 'bin';

export interface Operand {
  type: OperandType;
  /** Register index, immediate value, RAM address, resolved jump target, or bin index. */
  value: number;
  /** Original text, kept for display and for late label resolution. */
  text: string;
  col: number;
  endCol: number;
}

export interface Instr {
  op: string;
  a?: Operand;
  b?: Operand;
  cycles: number;
  /** 1-based source line this instruction came from. */
  line: number;
  /** Trimmed source text, for the disassembly view. */
  text: string;
}

export interface Program {
  instrs: Instr[];
  /** label -> instruction index */
  labels: Record<string, number>;
  diagnostics: Diagnostic[];
  ok: boolean;
  /** instruction index -> source line, for the current-line highlight. */
  lineOf: number[];
}

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

interface Token {
  text: string;
  col: number; // 1-based
  endCol: number;
}

const TOKEN_RE =
  /[,:[\]]|#?0[xX][0-9A-Fa-f]+|#?0[bB][01]+|#?\d+|#?[A-Za-z_][A-Za-z0-9_]*|\S/g;

function lex(line: string): Token[] {
  const withoutComment = stripComment(line);
  const tokens: Token[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(withoutComment)) !== null) {
    tokens.push({ text: m[0], col: m.index + 1, endCol: m.index + m[0].length + 1 });
  }
  return tokens;
}

function stripComment(line: string): string {
  const i = line.indexOf(';');
  if (i === -1) return line;
  // Blank the comment out rather than truncating, so columns stay honest.
  return line.slice(0, i) + ' '.repeat(line.length - i);
}

// ---------------------------------------------------------------------------
// Operand parsing
// ---------------------------------------------------------------------------

const REG_RE = /^[Rr]([0-7])$/;

function parseNumber(text: string): number | null {
  const body = text.startsWith('#') ? text.slice(1) : text;
  if (body === '') return null;
  let n: number;
  if (/^0[xX][0-9A-Fa-f]+$/.test(body)) n = parseInt(body.slice(2), 16);
  else if (/^0[bB][01]+$/.test(body)) n = parseInt(body.slice(2), 2);
  else if (/^\d+$/.test(body)) n = parseInt(body, 10);
  else return null;
  return Number.isFinite(n) ? n >>> 0 : null;
}

function lookupConstant(text: string): number | null {
  const body = text.startsWith('#') ? text.slice(1) : text;
  const upper = body.toUpperCase();
  return upper in NAMED_CONSTANTS ? NAMED_CONSTANTS[upper] : null;
}

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

export interface AssembleOptions {
  /** Restrict the usable instruction set. Omit to allow the whole ISA. */
  allowedOps?: readonly string[];
}

export function assemble(source: string, options: AssembleOptions = {}): Program {
  const diagnostics: Diagnostic[] = [];
  const instrs: Instr[] = [];
  const labels: Record<string, number> = {};
  const lineOf: number[] = [];
  const allowed = options.allowedOps ? new Set(options.allowedOps.map((o) => o.toUpperCase())) : null;

  /** Jump operands wait for a second pass, since labels may be defined later. */
  const pending: { operand: Operand; line: number }[] = [];

  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    let tokens = lex(lines[i]);
    if (tokens.length === 0) continue;

    // Leading "name:" declares a label at the next instruction index.
    while (tokens.length >= 2 && tokens[1].text === ':') {
      const name = tokens[0].text;
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        diagnostics.push(err(lineNo, tokens[0].col, tokens[0].endCol, `bad label name "${name}"`));
      } else if (name.toUpperCase() in OPS) {
        diagnostics.push(
          err(lineNo, tokens[0].col, tokens[0].endCol, `"${name}" is an instruction, not a usable label`),
        );
      } else if (name.toLowerCase() in labels) {
        diagnostics.push(err(lineNo, tokens[0].col, tokens[0].endCol, `label "${name}" already defined`));
      } else {
        labels[name.toLowerCase()] = instrs.length;
      }
      tokens = tokens.slice(2);
    }
    if (tokens.length === 0) continue;

    const mnemonicTok = tokens[0];
    const mnemonic = mnemonicTok.text.toUpperCase();
    const def = OPS[mnemonic];
    if (!def) {
      diagnostics.push(
        err(lineNo, mnemonicTok.col, mnemonicTok.endCol, `unknown instruction "${mnemonicTok.text}"`),
      );
      continue;
    }
    if (allowed && !allowed.has(mnemonic)) {
      diagnostics.push(
        err(
          lineNo,
          mnemonicTok.col,
          mnemonicTok.endCol,
          `${mnemonic} is not available on this level — check the ISA panel for what you have`,
        ),
      );
      continue;
    }

    // Split the remainder on commas into operand token groups.
    const rest = tokens.slice(1);
    const groups: Token[][] = [];
    let current: Token[] = [];
    for (const t of rest) {
      if (t.text === ',') {
        groups.push(current);
        current = [];
      } else {
        current.push(t);
      }
    }
    if (current.length > 0 || groups.length > 0) groups.push(current);

    if (groups.length !== def.operands.length) {
      const at = rest[0] ?? mnemonicTok;
      diagnostics.push(
        err(
          lineNo,
          at.col,
          rest.length ? rest[rest.length - 1].endCol : mnemonicTok.endCol,
          `${mnemonic} takes ${def.operands.length} operand${def.operands.length === 1 ? '' : 's'} (${def.syntax}), got ${groups.length}`,
        ),
      );
      continue;
    }

    const parsed: (Operand | null)[] = groups.map((g, idx) =>
      parseOperand(g, def.operands[idx], mnemonic, lineNo, diagnostics, mnemonicTok),
    );
    if (parsed.some((p) => p === null)) continue;

    const instr: Instr = {
      op: mnemonic,
      a: parsed[0] ?? undefined,
      b: parsed[1] ?? undefined,
      cycles: def.cycles,
      line: lineNo,
      text: lines[i].trim(),
    };

    for (const p of parsed) if (p && p.type === 'label') pending.push({ operand: p, line: lineNo });

    lineOf.push(lineNo);
    instrs.push(instr);
  }

  // Second pass: resolve label references now that every label is known.
  for (const { operand, line } of pending) {
    const target = labels[operand.text.toLowerCase()];
    if (target === undefined) {
      diagnostics.push(err(line, operand.col, operand.endCol, `unknown label "${operand.text}"`));
    } else {
      operand.value = target;
    }
  }

  return {
    instrs,
    labels,
    diagnostics,
    ok: diagnostics.every((d) => d.severity !== 'error'),
    lineOf,
  };
}

function parseOperand(
  tokens: Token[],
  kind: OperandKind,
  mnemonic: string,
  line: number,
  diagnostics: Diagnostic[],
  fallback: Token,
): Operand | null {
  if (tokens.length === 0) {
    diagnostics.push(err(line, fallback.col, fallback.endCol, `${mnemonic}: missing operand`));
    return null;
  }
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const col = first.col;
  const endCol = last.endCol;
  const joined = tokens.map((t) => t.text).join('');

  const fail = (message: string): null => {
    diagnostics.push(err(line, col, endCol, message));
    return null;
  };

  if (kind === 'mem') {
    if (first.text !== '[' || last.text !== ']' || tokens.length !== 3) {
      return fail(`${mnemonic}: expected a RAM reference like [4] or [R2], got "${joined}"`);
    }
    const inner = tokens[1];
    const reg = REG_RE.exec(inner.text);
    if (reg) {
      return { type: 'mem-reg', value: Number(reg[1]), text: joined, col, endCol };
    }
    const n = parseNumber(inner.text);
    if (n === null) return fail(`${mnemonic}: "${inner.text}" is not a RAM address or register`);
    if (n >= RAM_SIZE) {
      return fail(`RAM address ${n} is out of range — cells run 0..${RAM_SIZE - 1}`);
    }
    return { type: 'mem-imm', value: n, text: joined, col, endCol };
  }

  if (tokens.length !== 1) {
    return fail(`${mnemonic}: could not read operand "${joined}"`);
  }

  if (kind === 'label') {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(first.text)) {
      return fail(`${mnemonic}: "${first.text}" is not a valid label`);
    }
    // Resolved in the second pass.
    return { type: 'label', value: -1, text: first.text, col, endCol };
  }

  if (kind === 'bin') {
    const upper = first.text.toUpperCase();
    if (!(BINS as readonly string[]).includes(upper)) {
      return fail(
        `"${first.text}" is not a slice bin. Valid bins: ${BINS.join(', ')}`,
      );
    }
    return {
      type: 'bin',
      value: NAMED_CONSTANTS[upper as BinName],
      text: upper,
      col,
      endCol,
    };
  }

  const regMatch = REG_RE.exec(first.text);
  if (regMatch) {
    if (kind === 'imm') return fail(`${mnemonic}: expected an immediate here, not a register`);
    return { type: 'reg', value: Number(regMatch[1]), text: first.text.toUpperCase(), col, endCol };
  }

  // A bare R-something that is not R0..R7 is almost always a typo'd register.
  if (/^[Rr]\d+$/.test(first.text)) {
    return fail(`no such register "${first.text}" — this machine has R0..R${REGISTER_COUNT - 1}`);
  }

  if (kind === 'reg') {
    return fail(`${mnemonic}: expected a register R0..R${REGISTER_COUNT - 1}, got "${first.text}"`);
  }

  const constant = lookupConstant(first.text);
  if (constant !== null) {
    return { type: 'imm', value: constant >>> 0, text: first.text.toUpperCase(), col, endCol };
  }

  const n = parseNumber(first.text);
  if (n === null) {
    if (/^[A-Za-z_]/.test(first.text)) {
      return fail(`unknown symbol "${first.text}" — immediates look like #42, #0xFF or #0b1010`);
    }
    return fail(`${mnemonic}: "${first.text}" is not a valid operand`);
  }

  if (mnemonic === 'GETW' && n >= PACKET_WORDS) {
    return fail(`a packet has ${PACKET_WORDS} words — GETW takes #0 (header) or #1 (meta)`);
  }

  return { type: 'imm', value: n >>> 0, text: first.text, col, endCol };
}
