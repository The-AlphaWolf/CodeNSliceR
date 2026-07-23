/**
 * Level definition shape, plus the progressive instruction-unlock tiers.
 *
 * Each level hands the player a slightly wider machine than the last. The tier a
 * level sits on decides what the assembler will accept, what the ISA panel shows,
 * and what Monaco offers in completions.
 */

import { BinName, HeaderSpec, MetaSpec, encodeHeader, encodeMeta } from '../vm/packets';
import { Packet } from '../vm/vm';

/** Cumulative unlock tiers. Tier n grants everything in tiers 1..n. */
export const OP_TIERS: readonly (readonly string[])[] = [
  ['IN', 'EMIT', 'JEMPTY', 'JMP', 'NOP', 'HALT'], // 1 — move packets at all
  ['MOV', 'SHR', 'CMP', 'JZ', 'JNZ'], // 2 — slide a field down and test it
  ['AND'], // 3 — mask a field out of the middle of a word
  ['OR', 'XOR', 'NOT', 'SHL'], // 4 — build composite keys
  ['JLT', 'JGE', 'JGT', 'JLE'], // 5 — ranges
  ['LOAD', 'STORE', 'ADD', 'SUB'], // 6 — scratch RAM
  ['EMITR'], // 7 — table-driven dispatch
  ['GETW'], // 8 — the meta word
];

export function opsForTier(tier: number): string[] {
  return OP_TIERS.slice(0, tier).flat();
}

export interface LevelPacket extends Packet {
  expect: BinName;
  /** Short human description shown in the queue inspector, e.g. "4K video, non-GBR". */
  note: string;
}

export interface Level {
  /** Zero-padded id used in URLs and storage keys, e.g. "03". */
  id: string;
  num: number;
  title: string;
  /** Work-order one-liner shown under the title. */
  ticket: string;
  /** Briefing paragraphs. Plain text; rendered as separate blocks. */
  brief: string[];
  /** The routing rules, as the work order states them. Rendered as an ordered list. */
  rules: string[];
  bins: BinName[];
  tier: number;
  /** Packet fields the bit grid should emphasise on this level. */
  focusFields: string[];
  /** Glossary term ids to surface in the briefing. */
  glossary: string[];
  packets: LevelPacket[];
  par: { size: number; speed: number };
  hints: string[];
  reference: string;
  starter: string;
}

/** Terse constructor so level tables stay readable. */
export function pkt(
  id: number,
  expect: BinName,
  note: string,
  header: HeaderSpec,
  meta: MetaSpec = {},
): LevelPacket {
  return {
    id,
    words: [encodeHeader(header), encodeMeta(meta)],
    expect,
    note,
  };
}

export function expectationsOf(level: Level): Map<number, BinName> {
  return new Map(level.packets.map((p) => [p.id, p.expect]));
}

/** The scaffold every level starts the editor with. */
export const DEFAULT_STARTER = `; Pull packets until the ingress queue runs dry.
loop:
  JEMPTY done
  IN R0

  ; your classification logic here

  JMP loop
done:
  HALT
`;
