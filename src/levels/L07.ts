import { Level, pkt } from './schema';

export const L07: Level = {
  id: '07',
  num: 7,
  title: 'Ranges',
  ticket: 'WO-1082 — classify by 5QI band, not by value',
  brief: [
    'Standardized 5QI values come in bands. 1 through 9 are the original delay-sensitive profiles. 65 and up are the later additions covering broadband and mission-critical push-to-talk. Values outside both bands are not standardized and should not be on this link at all.',
    'CMP sets a second flag alongside Z: L is set when the left operand is less than the right, unsigned. JLT, JLE, JGT and JGE read the two flags together.',
    'A band test is two compares: reject below the floor, then accept at or below the ceiling.',
  ],
  rules: [
    '5QI 1..9 goes to SLICE_URLLC.',
    '5QI 65..85 goes to SLICE_EMBB.',
    'Anything else, including 5QI 0, goes to DROP.',
  ],
  bins: ['SLICE_EMBB', 'SLICE_URLLC', 'DROP'],
  tier: 5,
  focusFields: ['FIVEQI'],
  glossary: ['fiveqi', 'urllc', 'embb'],
  packets: [
    pkt(1, 'SLICE_URLLC', '5QI 1 — conversational voice', { SST: 1, FIVEQI: 1 }),
    pkt(2, 'SLICE_EMBB', '5QI 80 — low-latency eMBB', { SST: 1, FIVEQI: 80 }),
    pkt(3, 'DROP', '5QI 0 — unset', { SST: 1, FIVEQI: 0 }),
    pkt(4, 'SLICE_URLLC', '5QI 9 — top of the low band', { SST: 1, FIVEQI: 9 }),
    pkt(5, 'DROP', '5QI 40 — not standardized', { SST: 1, FIVEQI: 40 }),
    pkt(6, 'SLICE_EMBB', '5QI 65 — mission critical PTT', { SST: 2, FIVEQI: 65 }),
    pkt(7, 'SLICE_EMBB', '5QI 85 — top of the high band', { SST: 2, FIVEQI: 85 }),
    pkt(8, 'DROP', '5QI 200 — vendor junk', { SST: 1, FIVEQI: 200 }),
    pkt(9, 'SLICE_URLLC', '5QI 3 — real-time gaming', { SST: 2, FIVEQI: 3 }),
    pkt(10, 'DROP', '5QI 64 — one below the band', { SST: 1, FIVEQI: 64 }),
  ],
  par: { size: 19, speed: 120 },
  hints: [
    'Test the low band first: below 1 is a drop, at or below 9 is URLLC.',
    'If control reaches the second band the value is already above 9, so you only need the 65 floor and the 85 ceiling.',
    'Arrange the labels so the fall-through path after the last compare lands on the DROP emit. That saves a jump.',
  ],
  reference: `loop:
  JEMPTY done
  IN R0
  SHR R0, #8
  AND R0, #0xFF
  CMP R0, #1
  JLT drop
  CMP R0, #9
  JLE urllc
  CMP R0, #65
  JLT drop
  CMP R0, #85
  JLE embb
drop:
  EMIT DROP
  JMP loop
urllc:
  EMIT SLICE_URLLC
  JMP loop
embb:
  EMIT SLICE_EMBB
  JMP loop
done:
  HALT
`,
  starter: `; WO-1082 — two 5QI bands, everything else drops.
loop:
  JEMPTY done
  IN R0

  ; extract 5QI, then test the bands

  JMP loop
done:
  HALT
`,
};
