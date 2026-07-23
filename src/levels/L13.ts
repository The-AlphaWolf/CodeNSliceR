import { Level, pkt } from './schema';

export const L13: Level = {
  id: '13',
  num: 13,
  title: 'Priority Override',
  ticket: 'WO-1171 — emergency traffic outranks the slice request',
  brief: [
    'Allocation and Retention Priority is the field that decides who gets kept when the network runs out of room. It runs 1 to 15, and unlike everything else on this machine, lower means more important.',
    'Levels 1 through 4 are reserved for emergency services and network signalling. Those bearers take the low-latency slice regardless of what SST the UE asked for.',
    'ARP 0 is not a legal value. A packet carrying it is malformed and drops.',
    'ARP sits at bits 15..12 of the meta word — a nibble, so the mask is #0xF.',
  ],
  rules: [
    'ARP 0 goes to DROP — malformed.',
    'ARP 1..4 goes to SLICE_URLLC, whatever the SST says.',
    'Otherwise SST 3 goes to SLICE_MMTC.',
    'Otherwise SST 1 goes to SLICE_EMBB.',
    'Everything else goes to DROP.',
  ],
  bins: ['SLICE_EMBB', 'SLICE_URLLC', 'SLICE_MMTC', 'DROP'],
  tier: 8,
  focusFields: ['ARP', 'SST'],
  glossary: ['arp', 'urllc', 'mmtc'],
  packets: [
    pkt(1, 'SLICE_EMBB', 'ARP 8, SST 1 — ordinary video', { SST: 1, FIVEQI: 9 }, { LEN: 1200, ARP: 8 }),
    pkt(2, 'SLICE_URLLC', 'ARP 1, SST 1 — emergency call', { SST: 1, FIVEQI: 1 }, { LEN: 120, ARP: 1 }),
    pkt(3, 'SLICE_MMTC', 'ARP 13, SST 3 — meter', { SST: 3, FIVEQI: 7 }, { LEN: 40, ARP: 13 }),
    pkt(4, 'DROP', 'ARP 0 — malformed', { SST: 1, FIVEQI: 9 }, { LEN: 800, ARP: 0 }),
    pkt(5, 'SLICE_URLLC', 'ARP 4, SST 3 — alarm sensor', { SST: 3, FIVEQI: 6 }, { LEN: 60, ARP: 4 }),
    pkt(6, 'DROP', 'ARP 9, SST 4 — no V2X slice here', { SST: 4, FIVEQI: 75 }, { LEN: 300, ARP: 9 }),
    pkt(7, 'SLICE_URLLC', 'ARP 2, SST 2 — grid protection', { SST: 2, FIVEQI: 82 }, { LEN: 96, ARP: 2 }),
    pkt(8, 'SLICE_EMBB', 'ARP 5, SST 1 — one past the cutoff', { SST: 1, FIVEQI: 8 }, { LEN: 1400, ARP: 5 }),
    pkt(9, 'DROP', 'ARP 7, SST 2 — URLLC not admitted on ARP alone', { SST: 2, FIVEQI: 5 }, { LEN: 200, ARP: 7 }),
    pkt(10, 'SLICE_MMTC', 'ARP 15, SST 3 — lowest priority', { SST: 3, FIVEQI: 7 }, { LEN: 32, ARP: 15 }),
  ],
  par: { size: 22, speed: 126 },
  hints: [
    'ARP: GETW the meta word, SHR by 12, AND with #0xF.',
    'AND sets Z from its own result, so the malformed check is a bare JZ straight after the mask — no CMP needed.',
    'Packet 9 is SST 2 with ARP 7. The URLLC slice is only reachable through the ARP override on this level, so it drops.',
  ],
  reference: `loop:
  JEMPTY done
  IN R0
  GETW R1, #1
  SHR R1, #12
  AND R1, #0xF
  JZ drop
  CMP R1, #4
  JLE urllc
  SHR R0, #24
  CMP R0, #SST_MMTC
  JZ mmtc
  CMP R0, #SST_EMBB
  JZ embb
drop:
  EMIT DROP
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
  starter: `; WO-1171 — ARP 1..4 overrides SST. ARP 0 is malformed.
loop:
  JEMPTY done
  IN R0

  ; nibble at bits 15..12 of the meta word

  JMP loop
done:
  HALT
`,
};
