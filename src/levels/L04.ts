import { Level, pkt } from './schema';

export const L04: Level = {
  id: '04',
  num: 4,
  title: 'Two Slices',
  ticket: 'WO-1033 — light up the low-latency slice',
  brief: [
    'The URLLC slice is provisioned as of this morning. Traffic now has to be split three ways instead of two.',
    'A chain of CMP/JZ pairs is how you build a decision ladder: test the first case, branch out if it matches, otherwise fall through to the next test.',
    'Anything the ladder does not claim falls off the bottom and gets dropped.',
  ],
  rules: [
    'SST 1 (eMBB) goes to SLICE_EMBB.',
    'SST 2 (URLLC) goes to SLICE_URLLC.',
    'Any other SST goes to DROP.',
  ],
  bins: ['SLICE_EMBB', 'SLICE_URLLC', 'DROP'],
  tier: 3,
  focusFields: ['SST'],
  glossary: ['sst', 'urllc', 'embb'],
  packets: [
    pkt(1, 'SLICE_EMBB', 'Video stream', { SST: 1, FIVEQI: 9 }),
    pkt(2, 'SLICE_URLLC', 'Motion control', { SST: 2, FIVEQI: 82 }),
    pkt(3, 'DROP', 'Parking sensor', { SST: 3, FIVEQI: 7 }),
    pkt(4, 'SLICE_URLLC', 'Remote crane', { SST: 2, FIVEQI: 83 }),
    pkt(5, 'SLICE_EMBB', 'Cloud backup', { SST: 1, FIVEQI: 8 }),
    pkt(6, 'DROP', 'Platooning beacon', { SST: 4, FIVEQI: 75 }),
    pkt(7, 'DROP', 'Malformed — SST 0', { SST: 0, FIVEQI: 9 }),
    pkt(8, 'SLICE_URLLC', 'Grid protection relay', { SST: 2, FIVEQI: 82 }),
  ],
  par: { size: 14, speed: 70 },
  hints: [
    'Two compares, two conditional jumps, and a fall-through path that emits to DROP.',
    'Extract SST once at the top of the loop, then test the value you extracted twice.',
    'Every emit path needs its own JMP back to the loop top — otherwise control runs straight into the next emit and faults with an empty buffer.',
  ],
  reference: `loop:
  JEMPTY done
  IN R0
  SHR R0, #24
  CMP R0, #SST_EMBB
  JZ embb
  CMP R0, #SST_URLLC
  JZ urllc
  EMIT DROP
  JMP loop
embb:
  EMIT SLICE_EMBB
  JMP loop
urllc:
  EMIT SLICE_URLLC
  JMP loop
done:
  HALT
`,
  starter: `; WO-1033 — three-way split on SST.
loop:
  JEMPTY done
  IN R0
  SHR R0, #24

  ; build the decision ladder

  JMP loop
done:
  HALT
`,
};
