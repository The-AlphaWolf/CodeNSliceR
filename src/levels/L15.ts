import { Level, pkt } from './schema';

export const L15: Level = {
  id: '15',
  num: 15,
  title: 'Slice Classifier',
  ticket: 'WO-1200 — production cutover',
  brief: [
    'This is the real policy, the one that goes live at midnight. Header fields, meta fields, a tenant carve-out, transport markings, and an admission limit that has to hold across the whole shift.',
    'Nothing here is new. It is every rule you have written so far, stacked in one ordered ladder, and it has to be right for all sixteen packets.',
    'The admission counter applies only to packets that reach the SST 2 rule. Traffic that qualified earlier — expedited forwarding, or the stadium tenant — bypasses it and does not consume a slot.',
  ],
  rules: [
    'Payload length above 1500 goes to DROP.',
    'ARP 0 goes to DROP.',
    'DSCP 46 (EF) goes to SLICE_URLLC.',
    'SST 4 goes to SLICE_V2X.',
    'SST 1 with SD 0x10 goes to SLICE_URLLC.',
    'SST 2 goes to SLICE_URLLC — but only three of them. Later ones go to SLICE_EMBB.',
    'SST 3 goes to SLICE_MMTC.',
    'SST 1 goes to SLICE_EMBB.',
    'Anything left goes to DROP.',
  ],
  bins: ['SLICE_EMBB', 'SLICE_URLLC', 'SLICE_MMTC', 'SLICE_V2X', 'DROP'],
  tier: 8,
  focusFields: ['SST', 'SD', 'DSCP', 'ARP', 'LEN'],
  glossary: ['snssai', 'sst', 'sd', 'dscp', 'arp', 'admission', 'v2x'],
  packets: [
    pkt(1, 'SLICE_EMBB', 'SST 1 public, 1200 B', { SST: 1, SD: 0x01, FIVEQI: 9 }, { LEN: 1200, ARP: 8 }),
    pkt(2, 'SLICE_URLLC', 'SST 2 #1 — admitted', { SST: 2, SD: 0x0a, FIVEQI: 82 }, { LEN: 96, ARP: 6 }),
    pkt(3, 'SLICE_URLLC', 'EF marking — bypasses admission', { SST: 1, SD: 0x01, FIVEQI: 1, DSCP: 46 }, { LEN: 140, ARP: 5 }),
    pkt(4, 'SLICE_V2X', 'SST 4 roadside unit', { SST: 4, SD: 0x03, FIVEQI: 75 }, { LEN: 300, ARP: 6 }),
    pkt(5, 'SLICE_URLLC', 'SST 2 #2 — admitted', { SST: 2, SD: 0x0a, FIVEQI: 83 }, { LEN: 88, ARP: 7 }),
    pkt(6, 'SLICE_URLLC', 'Stadium tenant SD 0x10 — bypasses admission', { SST: 1, SD: 0x10, FIVEQI: 9 }, { LEN: 900, ARP: 9 }),
    pkt(7, 'DROP', 'ARP 0 — malformed', { SST: 2, SD: 0x0a, FIVEQI: 82 }, { LEN: 100, ARP: 0 }),
    pkt(8, 'SLICE_URLLC', 'SST 2 #3 — admitted, slice now full', { SST: 2, SD: 0x0a, FIVEQI: 82 }, { LEN: 92, ARP: 6 }),
    pkt(9, 'SLICE_MMTC', 'SST 3 water meter', { SST: 3, SD: 0x02, FIVEQI: 7 }, { LEN: 40, ARP: 14 }),
    pkt(10, 'SLICE_EMBB', 'SST 2 #4 — over the limit, degrades', { SST: 2, SD: 0x0a, FIVEQI: 82 }, { LEN: 96, ARP: 6 }),
    pkt(11, 'DROP', 'SST 1 but 4096 B — length wins over everything', { SST: 1, SD: 0x10, FIVEQI: 9, DSCP: 46 }, { LEN: 4096, ARP: 3 }),
    pkt(12, 'SLICE_V2X', 'SST 4 platooning, EF would have caught it first', { SST: 4, SD: 0x03, FIVEQI: 76 }, { LEN: 260, ARP: 4 }),
    pkt(13, 'SLICE_EMBB', 'SST 2 #5 — over the limit, degrades', { SST: 2, SD: 0x0a, FIVEQI: 83 }, { LEN: 84, ARP: 8 }),
    pkt(14, 'DROP', 'SST 7 — unprovisioned', { SST: 7, SD: 0x00, FIVEQI: 9 }, { LEN: 500, ARP: 10 }),
    pkt(15, 'SLICE_URLLC', 'EF on an SST 3 sensor — still bypasses', { SST: 3, SD: 0x02, FIVEQI: 6, DSCP: 46 }, { LEN: 60, ARP: 11 }),
    pkt(16, 'SLICE_EMBB', 'SST 1 public, exactly 1500 B', { SST: 1, SD: 0x22, FIVEQI: 8 }, { LEN: 1500, ARP: 9 }),
  ],
  par: { size: 48, speed: 391 },
  hints: [
    'Keep the admission count in a register rather than RAM. Registers persist across loop iterations and cost half as much to touch.',
    'You need SD and DSCP out of the header before you flatten it down to SST. Three scratch registers, one shift-and-mask each.',
    'Packet 11 carries EF and the stadium SD and still drops, because the length gate is rule one. Order the ladder exactly as the work order lists it.',
  ],
  reference: `  XOR R7, R7
loop:
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
  MOV R3, R0
  SHR R3, #2
  AND R3, #0x3F
  CMP R3, #46
  JZ urllc
  MOV R4, R0
  SHR R4, #16
  AND R4, #0xFF
  SHR R0, #24
  CMP R0, #SST_V2X
  JZ v2x
  CMP R0, #SST_EMBB
  JZ premium
  CMP R0, #SST_URLLC
  JZ admit
  CMP R0, #SST_MMTC
  JZ mmtc
drop:
  EMIT DROP
  JMP loop
premium:
  CMP R4, #0x10
  JZ urllc
  EMIT SLICE_EMBB
  JMP loop
admit:
  CMP R7, #3
  JGE embb
  ADD R7, #1
  EMIT SLICE_URLLC
  JMP loop
urllc:
  EMIT SLICE_URLLC
  JMP loop
embb:
  EMIT SLICE_EMBB
  JMP loop
v2x:
  EMIT SLICE_V2X
  JMP loop
mmtc:
  EMIT SLICE_MMTC
  JMP loop
done:
  HALT
`,
  starter: `; WO-1200 — production policy. Nine rules, first match wins.

  ; admission counter lives here

loop:
  JEMPTY done
  IN R0

  ; length, ARP, DSCP, SST 4, tenant, admission, SST ladder

  JMP loop
done:
  HALT
`,
};
