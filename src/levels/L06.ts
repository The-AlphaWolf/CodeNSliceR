import { Level, pkt } from './schema';

export const L06: Level = {
  id: '06',
  num: 6,
  title: 'Composite Key',
  ticket: 'WO-1068 — policy now depends on two fields at once',
  brief: [
    'Policy has stopped being a function of one field. The new table keys on SST and GBR together, and testing them separately means a compare ladder that doubles in length every time a field is added.',
    'Instead, build a key. SHL moves a field left; OR pastes another field into the space underneath it. K = (SST << 1) | GBR packs both into one small number you can compare once per case.',
    'XOR Rd, Rd is the cheapest way to clear a register, if you need a scratch value.',
  ],
  rules: [
    'Form K = (SST << 1) | GBR.',
    'K = 2 goes to SLICE_EMBB.',
    'K = 3, 4 or 5 goes to SLICE_URLLC.',
    'K = 6 goes to SLICE_MMTC.',
    'Any other K goes to DROP.',
  ],
  bins: ['SLICE_EMBB', 'SLICE_URLLC', 'SLICE_MMTC', 'DROP'],
  tier: 4,
  focusFields: ['SST', 'GBR'],
  glossary: ['sst', 'gbr', 'urllc'],
  packets: [
    pkt(1, 'SLICE_EMBB', 'SST 1, non-GBR — K=2', { SST: 1, FIVEQI: 9, GBR: 0 }),
    pkt(2, 'SLICE_URLLC', 'SST 1, GBR — K=3', { SST: 1, FIVEQI: 1, GBR: 1 }),
    pkt(3, 'SLICE_URLLC', 'SST 2, non-GBR — K=4', { SST: 2, FIVEQI: 5, GBR: 0 }),
    pkt(4, 'SLICE_URLLC', 'SST 2, GBR — K=5', { SST: 2, FIVEQI: 82, GBR: 1 }),
    pkt(5, 'SLICE_MMTC', 'SST 3, non-GBR — K=6', { SST: 3, FIVEQI: 7, GBR: 0 }),
    pkt(6, 'DROP', 'SST 3, GBR — K=7, not provisioned', { SST: 3, FIVEQI: 3, GBR: 1 }),
    pkt(7, 'DROP', 'SST 4 — K=8, no V2X slice here', { SST: 4, FIVEQI: 75, GBR: 0 }),
    pkt(8, 'DROP', 'Malformed — SST 0, K=0', { SST: 0, FIVEQI: 9, GBR: 0 }),
    pkt(9, 'SLICE_EMBB', 'SST 1, non-GBR — K=2', { SST: 1, FIVEQI: 8, GBR: 0 }),
  ],
  par: { size: 26, speed: 145 },
  hints: [
    'Save GBR into a scratch register before you shift the header — the shift destroys it.',
    'SHR R0, #24 gives you SST; SHL R0, #1 makes room for one bit underneath; OR R0, R1 drops GBR into that space.',
    'With a key in hand, the three URLLC cases are still three separate compares. Level 7 hands you the range jumps that collapse them into one.',
  ],
  reference: `loop:
  JEMPTY done
  IN R0
  MOV R1, R0
  AND R1, #1
  SHR R0, #24
  SHL R0, #1
  OR R0, R1
  CMP R0, #2
  JZ embb
  CMP R0, #6
  JZ mmtc
  CMP R0, #3
  JZ urllc
  CMP R0, #4
  JZ urllc
  CMP R0, #5
  JZ urllc
  EMIT DROP
  JMP loop
embb:
  EMIT SLICE_EMBB
  JMP loop
urllc:
  EMIT SLICE_URLLC
  JMP loop
mmtc:
  EMIT SLICE_MMTC
  JMP loop
done:
  HALT
`,
  starter: `; WO-1068 — K = (SST << 1) | GBR, then dispatch on K.
loop:
  JEMPTY done
  IN R0

  ; build the key

  JMP loop
done:
  HALT
`,
};
