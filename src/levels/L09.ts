import { Level, pkt } from './schema';

export const L09: Level = {
  id: '09',
  num: 9,
  title: 'Lookup Table',
  ticket: 'WO-1110 — replace the compare ladder with a table',
  brief: [
    'All four slice types are provisioned. A compare ladder would now be eight instructions deep on the worst path, and it grows every time operations sells another slice.',
    'EMITR emits to the bin whose index sits in a register, and the bin indices are fixed for the whole game: 0 = SLICE_EMBB, 1 = SLICE_URLLC, 2 = SLICE_MMTC, 3 = SLICE_V2X, 4 = DROP. Write those indices into RAM once, indexed by SST, and the entire decision collapses into LOAD then EMITR.',
    'LOAD Rd, [Rs] reads the cell whose address is in Rs. Indirect addressing is the whole trick.',
    'The radio scheduler on this link never emits an SST above 7, so a table of eight cells covers every value you will see.',
  ],
  rules: [
    'SST 1 goes to SLICE_EMBB.',
    'SST 2 goes to SLICE_URLLC.',
    'SST 3 goes to SLICE_MMTC.',
    'SST 4 goes to SLICE_V2X.',
    'SST 0 and SST 5..7 go to DROP.',
  ],
  bins: ['SLICE_EMBB', 'SLICE_URLLC', 'SLICE_MMTC', 'SLICE_V2X', 'DROP'],
  tier: 7,
  focusFields: ['SST'],
  glossary: ['sst', 'v2x', 'slice'],
  packets: [
    pkt(1, 'SLICE_EMBB', 'SST 1 — video', { SST: 1, FIVEQI: 9 }),
    pkt(2, 'SLICE_V2X', 'SST 4 — platooning beacon', { SST: 4, FIVEQI: 75 }),
    pkt(3, 'SLICE_MMTC', 'SST 3 — water meter', { SST: 3, FIVEQI: 7 }),
    pkt(4, 'DROP', 'SST 0 — malformed', { SST: 0, FIVEQI: 9 }),
    pkt(5, 'SLICE_URLLC', 'SST 2 — motion control', { SST: 2, FIVEQI: 82 }),
    pkt(6, 'DROP', 'SST 6 — reserved, unprovisioned', { SST: 6, FIVEQI: 9 }),
    pkt(7, 'SLICE_V2X', 'SST 4 — collision warning', { SST: 4, FIVEQI: 76 }),
    pkt(8, 'SLICE_EMBB', 'SST 1 — file sync', { SST: 1, FIVEQI: 8 }),
    pkt(9, 'DROP', 'SST 7 — reserved, unprovisioned', { SST: 7, FIVEQI: 5 }),
    pkt(10, 'SLICE_MMTC', 'SST 3 — streetlight', { SST: 3, FIVEQI: 6 }),
  ],
  par: { size: 20, speed: 93 },
  hints: [
    'Build the table before the loop starts. Instructions above the loop label run exactly once.',
    'Bin names are usable as immediates: MOV R1, #SLICE_V2X puts 3 in R1. STORE [4], R1 then means "SST 4 routes to V2X".',
    'RAM is zeroed at reset and 0 means SLICE_EMBB, so the unprovisioned cells will not drop by themselves — write DROP into cells 0, 5, 6 and 7 explicitly.',
  ],
  reference: `  MOV R1, #SLICE_EMBB
  STORE [1], R1
  MOV R1, #SLICE_URLLC
  STORE [2], R1
  MOV R1, #SLICE_MMTC
  STORE [3], R1
  MOV R1, #SLICE_V2X
  STORE [4], R1
  MOV R1, #DROP
  STORE [0], R1
  STORE [5], R1
  STORE [6], R1
  STORE [7], R1
loop:
  JEMPTY done
  IN R0
  SHR R0, #24
  LOAD R2, [R0]
  EMITR R2
  JMP loop
done:
  HALT
`,
  starter: `; WO-1110 — RAM cell N holds the bin index for SST N.

  ; build the table here, it runs once

loop:
  JEMPTY done
  IN R0

  ; look the answer up instead of comparing

  JMP loop
done:
  HALT
`,
};
