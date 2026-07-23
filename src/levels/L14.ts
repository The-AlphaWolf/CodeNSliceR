import { Level, pkt } from './schema';

export const L14: Level = {
  id: '14',
  num: 14,
  title: 'Composite Policy',
  ticket: 'WO-1188 — one classifier, the whole rule book',
  brief: [
    'Operations has consolidated four separate work orders into one policy document. Every field you have learned is in play, and the rules are ordered — the first rule that matches wins.',
    'Nothing new is unlocked here. This level is about reading an ordered policy and turning it into control flow that evaluates in the same order, cheaply.',
    'Extract each field once. Re-deriving SST three times down three branches is how programs get slow.',
  ],
  rules: [
    'Payload length above 1500 goes to DROP.',
    'ARP 0 goes to DROP.',
    'SST 4 goes to SLICE_V2X.',
    'ARP 1..3 goes to SLICE_URLLC.',
    'SST 2 goes to SLICE_URLLC.',
    'SST 3 goes to SLICE_MMTC.',
    'SST 1 goes to SLICE_EMBB.',
    'Anything left goes to DROP.',
  ],
  bins: ['SLICE_EMBB', 'SLICE_URLLC', 'SLICE_MMTC', 'SLICE_V2X', 'DROP'],
  tier: 8,
  focusFields: ['SST', 'ARP', 'LEN'],
  glossary: ['arp', 'mtu', 'sst', 'v2x'],
  packets: [
    pkt(1, 'SLICE_EMBB', 'SST 1, ARP 8, 1200 B', { SST: 1, FIVEQI: 9 }, { LEN: 1200, ARP: 8 }),
    pkt(2, 'DROP', 'SST 4 but 2000 B — length wins', { SST: 4, FIVEQI: 75 }, { LEN: 2000, ARP: 6 }),
    pkt(3, 'SLICE_V2X', 'SST 4, ARP 6 — V2X beats the ARP rule', { SST: 4, FIVEQI: 75 }, { LEN: 300, ARP: 6 }),
    pkt(4, 'SLICE_V2X', 'SST 4, ARP 2 — SST 4 is checked first', { SST: 4, FIVEQI: 76 }, { LEN: 280, ARP: 2 }),
    pkt(5, 'SLICE_URLLC', 'SST 1, ARP 2 — priority override', { SST: 1, FIVEQI: 1 }, { LEN: 140, ARP: 2 }),
    pkt(6, 'SLICE_URLLC', 'SST 2, ARP 9 — slice type wins', { SST: 2, FIVEQI: 82 }, { LEN: 96, ARP: 9 }),
    pkt(7, 'SLICE_MMTC', 'SST 3, ARP 14', { SST: 3, FIVEQI: 7 }, { LEN: 40, ARP: 14 }),
    pkt(8, 'DROP', 'ARP 0 — malformed', { SST: 2, FIVEQI: 82 }, { LEN: 100, ARP: 0 }),
    pkt(9, 'SLICE_URLLC', 'SST 3, ARP 3 — override', { SST: 3, FIVEQI: 6 }, { LEN: 60, ARP: 3 }),
    pkt(10, 'DROP', 'SST 6 — unprovisioned', { SST: 6, FIVEQI: 9 }, { LEN: 500, ARP: 10 }),
    pkt(11, 'SLICE_MMTC', 'SST 3, ARP 4 — one past the override', { SST: 3, FIVEQI: 7 }, { LEN: 44, ARP: 4 }),
    pkt(12, 'DROP', 'SST 1, 1501 B — one byte over', { SST: 1, FIVEQI: 8 }, { LEN: 1501, ARP: 7 }),
  ],
  par: { size: 32, speed: 203 },
  hints: [
    'Read the meta word once, copy it, and derive length from the copy so the original is still there for the ARP nibble.',
    'The rule order is not the same as the field order. SST 4 is tested before the ARP band, which is why packet 4 goes to V2X and not URLLC.',
    'The DROP emit can sit at the bottom of the ladder as a fall-through target and also be jumped to from the two early checks.',
  ],
  reference: `loop:
  JEMPTY done
  IN R0
  GETW R1, #1
  MOV R2, R1
  SHR R2, #16
  CMP R2, #1500
  JGT drop
  SHR R1, #12
  AND R1, #0xF
  JZ drop
  SHR R0, #24
  CMP R0, #SST_V2X
  JZ v2x
  CMP R1, #3
  JLE urllc
  CMP R0, #SST_URLLC
  JZ urllc
  CMP R0, #SST_MMTC
  JZ mmtc
  CMP R0, #SST_EMBB
  JZ embb
drop:
  EMIT DROP
  JMP loop
v2x:
  EMIT SLICE_V2X
  JMP loop
urllc:
  EMIT SLICE_URLLC
  JMP loop
mmtc:
  EMIT SLICE_MMTC
  JMP loop
embb:
  EMIT SLICE_EMBB
  JMP loop
done:
  HALT
`,
  starter: `; WO-1188 — ordered policy. First matching rule wins.
loop:
  JEMPTY done
  IN R0

  ; length, then ARP 0, then SST 4, then the ARP band, then the SST ladder

  JMP loop
done:
  HALT
`,
};
