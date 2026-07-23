import { Level, pkt } from './schema';

export const L11: Level = {
  id: '11',
  num: 11,
  title: 'DiffServ',
  ticket: 'WO-1140 — trust the transport marking',
  brief: [
    'The enterprise customer marks its own traffic at the IP layer and expects the core to honour it. DSCP rides up from the transport header into bits 7..2 of ours.',
    'This is the first field that is neither byte-aligned nor a single bit. Six bits, starting at bit 2, with RQI and GBR sitting underneath. Shift by 2, then mask with #0x3F.',
    'Expedited Forwarding (46) is the classic voice marking. AF41 (34) is what the V2X roadside units use. Default (0) means the sender expressed no preference.',
  ],
  rules: [
    'DSCP 46 (EF) goes to SLICE_URLLC.',
    'DSCP 34 (AF41) goes to SLICE_V2X.',
    'DSCP 0 (default) goes to SLICE_EMBB.',
    'Any other DSCP goes to DROP.',
  ],
  bins: ['SLICE_EMBB', 'SLICE_URLLC', 'SLICE_V2X', 'DROP'],
  tier: 7,
  focusFields: ['DSCP'],
  glossary: ['dscp', 'urllc', 'v2x'],
  packets: [
    pkt(1, 'SLICE_URLLC', 'EF — voice bearer', { SST: 1, FIVEQI: 1, DSCP: 46, GBR: 1 }),
    pkt(2, 'SLICE_EMBB', 'Default — bulk download', { SST: 1, FIVEQI: 9, DSCP: 0 }),
    pkt(3, 'SLICE_V2X', 'AF41 — roadside unit', { SST: 4, FIVEQI: 75, DSCP: 34 }),
    pkt(4, 'DROP', 'CS1 (8) — scavenger class', { SST: 1, FIVEQI: 9, DSCP: 8 }),
    pkt(5, 'SLICE_URLLC', 'EF — remote control loop', { SST: 2, FIVEQI: 82, DSCP: 46, RQI: 1 }),
    pkt(6, 'DROP', 'AF31 (26) — not in policy', { SST: 1, FIVEQI: 8, DSCP: 26 }),
    pkt(7, 'SLICE_EMBB', 'Default — web browsing', { SST: 3, FIVEQI: 7, DSCP: 0 }),
    pkt(8, 'SLICE_V2X', 'AF41 — collision warning', { SST: 4, FIVEQI: 76, DSCP: 34, GBR: 1 }),
    pkt(9, 'DROP', 'DSCP 63 — every bit set', { SST: 1, FIVEQI: 9, DSCP: 63, RQI: 1, GBR: 1 }),
    pkt(10, 'SLICE_URLLC', 'EF — voice bearer', { SST: 1, FIVEQI: 1, DSCP: 46 }),
  ],
  par: { size: 19, speed: 106 },
  hints: [
    'DSCP starts at bit 2, not bit 0. SHR R0, #2 first.',
    '#0x3F is six set bits — the mask you want after shifting.',
    'Packet 9 has RQI and GBR set as well. If your mask is wrong those bits leak into the value and no case will match.',
  ],
  reference: `loop:
  JEMPTY done
  IN R0
  SHR R0, #2
  AND R0, #0x3F
  CMP R0, #46
  JZ urllc
  CMP R0, #34
  JZ v2x
  CMP R0, #0
  JZ embb
  EMIT DROP
  JMP loop
urllc:
  EMIT SLICE_URLLC
  JMP loop
v2x:
  EMIT SLICE_V2X
  JMP loop
embb:
  EMIT SLICE_EMBB
  JMP loop
done:
  HALT
`,
  starter: `; WO-1140 — route on the DSCP marking at bits 7..2.
loop:
  JEMPTY done
  IN R0

  ; six bits, starting at bit 2

  JMP loop
done:
  HALT
`,
};
