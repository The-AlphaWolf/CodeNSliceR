# CodeNSliceR

**Play it: [codenslicer.vercel.app](https://codenslicer.vercel.app)**

A terminal-flavoured puzzle game in the spirit of *Human Resource Machine*, except the machine is a
5G packet classifier. You write assembly with bit-manipulation instructions, decode a 32-bit packet
header, and route traffic into network slices — eMBB, URLLC, mMTC, V2X, or the bin.

Fifteen work orders, from "emit everything to one slice" to a nine-rule production policy with
tenant carve-outs, DiffServ trust and an admission limit.

The 5G is real. SST values, 5QI bands, DSCP codepoints, ARP priority and the S-NSSAI structure are
taken from the actual specs; the in-game codex says exactly where the game simplifies them.

## Run it

```bash
npm install
npm run dev
```

Desktop only — the editor, machine panels and traffic queues all have to be on screen at once.

## The machine

Eight 32-bit registers, sixteen RAM cells, an ingress queue, one packet buffer, and per-slice
egress bins. Two flags: `Z` (equal or zero) and `L` (unsigned less-than).

```
header word          meta word
31..24  SST          31..16  payload length
23..16  SD           15..12  ARP priority
15..8   5QI          11..8   UE category
 7..2   DSCP          7..0   TEID low byte
    1   RQI
    0   GBR
```

```asm
loop:
  JEMPTY done
  IN R0
  SHR R0, #24          ; slide SST down to bit 0
  CMP R0, #SST_URLLC
  JZ urllc
  EMIT SLICE_EMBB
  JMP loop
urllc:
  EMIT SLICE_URLLC
  JMP loop
done:
  HALT
```

Instructions unlock progressively: level 1 gives you six, level 15 gives you the lot. Nothing is
ever taken away.

## Scoring

Every level ships two par numbers — **size** (instructions assembled) and **speed** (cycles
retired). Meet par to close the work order; beat it for a gold badge. `LOAD` and `STORE` cost two
cycles, everything else costs one.

## Layout

```
src/vm/          the machine: ISA table, assembler, VM, trace, grading, packet format
src/levels/      15 level definitions, each with packets, par, hints and a reference solution
src/content/     the codex — every 5G term the game uses
src/state/       zustand store and localStorage progress
src/ui/          three-pane terminal shell, Monaco language, debugger panels
tools/           headless level runner
tests/           assembler, VM and campaign suites
```

`src/vm/packets.ts` is the hinge: field offsets and widths are declared once and consumed by the
level definitions, the assembler's constant table, and the bit-grid UI.

## Development

```bash
npm test              # assembler, VM, and all 15 reference solutions against par
npm run typecheck
npm run level -- all  # headless: every reference solution, with size and cycle counts
npm run level -- 09 my-solution.cns
npm run build
```

Each level's reference solution is executable content: it powers the reveal-solution feature and
doubles as the test that proves the level is solvable at the par it advertises.

## Deploy

Static build, no backend — live on Vercel at
[codenslicer.vercel.app](https://codenslicer.vercel.app), redeployed from `main`.

`npm run build` emits `dist/`; any static host will serve it. Progress lives in `localStorage`,
with export/import from the campaign roster for moving solutions between browsers.
