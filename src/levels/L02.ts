import { Level, pkt } from './schema';

export const L02: Level = {
  id: '02',
  num: 2,
  title: 'Shift Down',
  ticket: 'WO-1014 — reject traffic that is not ours',
  brief: [
    'The header word packs four fields plus two flags into 32 bits. The Slice/Service Type sits in the top byte, bits 31 down to 24.',
    'To test a field you first have to move it somewhere you can compare: SHR slides the whole word right, so SHR R0, #24 leaves SST sitting in bits 7..0 and nothing else.',
    'CMP subtracts without storing the result and sets the Z flag when the two values match. JZ jumps when Z is set.',
  ],
  rules: ['SST 1 (eMBB) goes to SLICE_EMBB.', 'Everything else goes to DROP.'],
  bins: ['SLICE_EMBB', 'DROP'],
  tier: 2,
  focusFields: ['SST'],
  glossary: ['sst', 'slice', 'embb'],
  packets: [
    pkt(1, 'SLICE_EMBB', 'Video stream', { SST: 1, FIVEQI: 9 }),
    pkt(2, 'DROP', 'Robot arm telemetry — no URLLC slice here', { SST: 2, FIVEQI: 82 }),
    pkt(3, 'SLICE_EMBB', 'App download', { SST: 1, FIVEQI: 8 }),
    pkt(4, 'DROP', 'Water meter reading', { SST: 3, FIVEQI: 7 }),
    pkt(5, 'DROP', 'Platooning beacon', { SST: 4, FIVEQI: 75 }),
    pkt(6, 'SLICE_EMBB', 'Voice over NR', { SST: 1, FIVEQI: 1 }),
  ],
  par: { size: 10, speed: 44 },
  hints: [
    'SST is the top byte. One SHR R0, #24 is enough — nothing is left above it to mask off.',
    'CMP R0, #1 then JZ. The constant SST_EMBB is also accepted and reads better.',
    'You need two exit paths from the compare: one that emits to SLICE_EMBB and one that emits to DROP. Both must JMP back to the loop top afterwards.',
  ],
  reference: `loop:
  JEMPTY done
  IN R0
  SHR R0, #24
  CMP R0, #SST_EMBB
  JZ embb
  EMIT DROP
  JMP loop
embb:
  EMIT SLICE_EMBB
  JMP loop
done:
  HALT
`,
  starter: `; WO-1014 — only SST 1 belongs to us.
loop:
  JEMPTY done
  IN R0

  ; slide SST down, compare, branch

  JMP loop
done:
  HALT
`,
};
