import { Level, pkt } from './schema';

export const L03: Level = {
  id: '03',
  num: 3,
  title: 'Mask Work',
  ticket: 'WO-1027 — pull the delay-critical profile out',
  brief: [
    'The 5QI field is not at the top of the word. It sits at bits 15..8, with SST and SD stacked above it and DSCP, RQI and GBR below.',
    'Shifting right by 8 drops everything below 5QI, but SST and SD are still riding along above it. AND with a mask clears them: AND R0, #0xFF keeps the low eight bits and zeroes the rest.',
    'Shift down, then mask off. That two-step is the single most used move in this job.',
  ],
  rules: ['5QI 82 goes to SLICE_URLLC.', 'Every other 5QI goes to SLICE_EMBB.'],
  bins: ['SLICE_EMBB', 'SLICE_URLLC'],
  tier: 3,
  focusFields: ['FIVEQI'],
  glossary: ['fiveqi', 'urllc', 'embb'],
  packets: [
    pkt(1, 'SLICE_EMBB', 'Video stream', { SST: 1, SD: 0x01, FIVEQI: 9 }),
    pkt(2, 'SLICE_URLLC', 'Discrete automation', { SST: 2, SD: 0x0a, FIVEQI: 82 }),
    pkt(3, 'SLICE_EMBB', 'Voice over NR', { SST: 1, SD: 0x01, FIVEQI: 1 }),
    pkt(4, 'SLICE_URLLC', 'Motion control', { SST: 2, SD: 0x0a, FIVEQI: 82 }),
    pkt(5, 'SLICE_EMBB', 'Live sports feed', { SST: 1, SD: 0x2f, FIVEQI: 80 }),
    pkt(6, 'SLICE_EMBB', 'Sensor batch upload', { SST: 3, SD: 0xff, FIVEQI: 83 }),
  ],
  par: { size: 11, speed: 50 },
  hints: [
    'SHR R0, #8 puts 5QI in the bottom byte — but SST and SD are still sitting above it.',
    'AND R0, #0xFF clears everything except the low eight bits.',
    'Order matters: shift first, then mask. Masking first would keep DSCP and the flags instead.',
  ],
  reference: `loop:
  JEMPTY done
  IN R0
  SHR R0, #8
  AND R0, #0xFF
  CMP R0, #82
  JZ urllc
  EMIT SLICE_EMBB
  JMP loop
urllc:
  EMIT SLICE_URLLC
  JMP loop
done:
  HALT
`,
  starter: `; WO-1027 — 5QI 82 is delay-critical. Everything else is broadband.
loop:
  JEMPTY done
  IN R0

  ; extract 5QI: shift down, then mask

  JMP loop
done:
  HALT
`,
};
