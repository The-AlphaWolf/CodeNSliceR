import { describe, expect, it } from 'vitest';
import { assemble } from '@/vm/assembler';
import { CnVm } from '@/vm/vm';
import { grade } from '@/vm/grade';
import { LEVELS } from '@/levels';
import { Level, expectationsOf, opsForTier } from '@/levels/schema';
import { GLOSSARY_BY_ID } from '@/content/glossary';
import { BINS } from '@/vm/packets';

function solve(level: Level, source: string) {
  const program = assemble(source, { allowedOps: opsForTier(level.tier) });
  expect(program.diagnostics).toEqual([]);
  const vm = new CnVm(program, { packets: level.packets, provisionedBins: level.bins });
  vm.run();
  return grade({
    packets: level.packets,
    expected: expectationsOf(level),
    state: vm.state,
    size: program.instrs.length,
  });
}

describe.each(LEVELS.map((l) => [l.id, l] as const))('level %s', (_id, level) => {
  it('is solved by its reference solution', () => {
    const result = solve(level, level.reference);
    expect(result.fault).toBeNull();
    expect(result.misrouted).toEqual([]);
    expect(result.unprocessed).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it('meets its own par', () => {
    const result = solve(level, level.reference);
    expect(result.size).toBeLessThanOrEqual(level.par.size);
    expect(result.cycles).toBeLessThanOrEqual(level.par.speed);
  });

  it('assembles its starter without errors', () => {
    const program = assemble(level.starter, { allowedOps: opsForTier(level.tier) });
    expect(program.diagnostics).toEqual([]);
  });

  it('only emits to bins it provisions', () => {
    for (const p of level.packets) expect(level.bins).toContain(p.expect);
  });

  it('exercises every bin it provisions', () => {
    const used = new Set(level.packets.map((p) => p.expect));
    for (const bin of level.bins) expect(used.has(bin)).toBe(true);
  });

  it('has unique packet ids', () => {
    const ids = level.packets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('references glossary terms that exist', () => {
    for (const term of level.glossary) expect(GLOSSARY_BY_ID[term]).toBeDefined();
  });

  it('ships three hints', () => {
    expect(level.hints).toHaveLength(3);
  });
});

describe('campaign shape', () => {
  it('numbers levels contiguously from 1', () => {
    LEVELS.forEach((level, i) => {
      expect(level.num).toBe(i + 1);
      expect(level.id).toBe(String(i + 1).padStart(2, '0'));
    });
  });

  it('never takes an instruction away from the player', () => {
    let previous: string[] = [];
    for (const level of LEVELS) {
      const ops = opsForTier(level.tier);
      for (const op of previous) expect(ops).toContain(op);
      previous = ops;
    }
  });

  it('unlocks every instruction the reference solutions use', () => {
    for (const level of LEVELS) {
      const program = assemble(level.reference, { allowedOps: opsForTier(level.tier) });
      expect(program.diagnostics).toEqual([]);
    }
  });

  it('introduces every bin in the vocabulary by the end', () => {
    const seen = new Set(LEVELS.flatMap((l) => l.bins));
    for (const bin of BINS) expect(seen.has(bin)).toBe(true);
  });

  it('grows in difficulty without ever shrinking the packet set below five', () => {
    for (const level of LEVELS) expect(level.packets.length).toBeGreaterThanOrEqual(5);
  });
});

describe('grading rejects wrong answers', () => {
  it('flags a program that sends everything to one bin', () => {
    const level = LEVELS[3]; // L04 — three-way split
    const result = solve(
      level,
      `loop:
  JEMPTY done
  IN R0
  EMIT DROP
  JMP loop
done:
  HALT
`,
    );
    expect(result.passed).toBe(false);
    expect(result.misrouted.length).toBeGreaterThan(0);
    expect(result.message).toContain('work order requires');
  });

  it('flags a program that stops early', () => {
    const level = LEVELS[0];
    const result = solve(level, 'IN R0\n  EMIT SLICE_EMBB\n  HALT');
    expect(result.passed).toBe(false);
    expect(result.unprocessed).toHaveLength(level.packets.length - 1);
    expect(result.message).toContain('still unrouted');
  });
});
