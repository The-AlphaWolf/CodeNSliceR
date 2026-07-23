/**
 * Headless harness: assemble a solution and grade it against a level, no browser.
 *
 *   npm run level -- 09                 # run the level's reference solution
 *   npm run level -- 09 my-solution.cns # run a file
 *   npm run level -- all                # every level, reference solutions, with par numbers
 */

import { readFileSync } from 'node:fs';
import { assemble } from '../src/vm/assembler';
import { CnVm } from '../src/vm/vm';
import { grade } from '../src/vm/grade';
import { LEVELS, levelById } from '../src/levels';
import { Level, expectationsOf, opsForTier } from '../src/levels/schema';

function runOne(level: Level, source: string) {
  const program = assemble(source, { allowedOps: opsForTier(level.tier) });
  if (!program.ok) {
    return { program, result: null as null | ReturnType<typeof grade> };
  }
  const vm = new CnVm(program, { packets: level.packets, provisionedBins: level.bins });
  vm.run();
  const result = grade({
    packets: level.packets,
    expected: expectationsOf(level),
    state: vm.state,
    size: program.instrs.length,
  });
  return { program, result };
}

function report(level: Level, source: string): boolean {
  const { program, result } = runOne(level, source);
  const tag = `${level.id} ${level.title}`.padEnd(26);
  if (!program.ok) {
    console.log(`FAIL ${tag} assembler errors:`);
    for (const d of program.diagnostics) {
      console.log(`       line ${d.line}:${d.col}  ${d.message}`);
    }
    return false;
  }
  const r = result!;
  const status = r.passed ? 'PASS' : 'FAIL';
  console.log(
    `${status} ${tag} size=${String(r.size).padStart(3)} cycles=${String(r.cycles).padStart(4)}` +
      `  par(size=${level.par.size}, speed=${level.par.speed})`,
  );
  if (!r.passed) console.log(`       ${r.message}`);
  return r.passed;
}

const [target, file] = process.argv.slice(2);

if (!target || target === 'all') {
  let ok = true;
  for (const level of LEVELS) ok = report(level, level.reference) && ok;
  process.exit(ok ? 0 : 1);
} else {
  const level = levelById(target.padStart(2, '0'));
  if (!level) {
    console.error(`no such level: ${target}`);
    process.exit(2);
  } else {
    const source = file ? readFileSync(file, 'utf8') : level.reference;
    process.exit(report(level, source) ? 0 : 1);
  }
}
