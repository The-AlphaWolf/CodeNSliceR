import { Level, pkt } from './schema';

export const L12: Level = {
  id: '12',
  num: 12,
  title: 'MTU Gate',
  ticket: 'WO-1157 — stop oversized frames at the edge',
  brief: [
    'Every packet carries a second word. GETW R1, #1 reads it: payload length in the top 16 bits, then ARP, UE category, and the low byte of the GTP-U tunnel id.',
    'The transport MTU on this link is 1500 bytes. Anything larger will not survive the tunnel, so it gets discarded here rather than three hops downstream.',
    'GETW works on whatever packet is in the buffer, so it must come after IN and before EMIT.',
  ],
  rules: [
    'Payload length above 1500 goes to DROP, whatever the SST is.',
    'Otherwise SST 2 goes to SLICE_URLLC.',
    'Otherwise SST 3 goes to SLICE_MMTC.',
    'Everything else goes to SLICE_EMBB.',
  ],
  bins: ['SLICE_EMBB', 'SLICE_URLLC', 'SLICE_MMTC', 'DROP'],
  tier: 8,
  focusFields: ['LEN', 'SST'],
  glossary: ['mtu', 'teid', 'sst'],
  packets: [
    pkt(1, 'SLICE_EMBB', '1200 B video segment', { SST: 1, FIVEQI: 9 }, { LEN: 1200, ARP: 8, TEID: 0x21 }),
    pkt(2, 'DROP', '9000 B jumbo frame', { SST: 1, FIVEQI: 9 }, { LEN: 9000, ARP: 8, TEID: 0x22 }),
    pkt(3, 'SLICE_URLLC', '96 B control message', { SST: 2, FIVEQI: 82 }, { LEN: 96, ARP: 2, TEID: 0x23 }),
    pkt(4, 'SLICE_MMTC', '40 B meter reading', { SST: 3, FIVEQI: 7 }, { LEN: 40, ARP: 12, TEID: 0x24 }),
    pkt(5, 'DROP', '1501 B — one byte over', { SST: 2, FIVEQI: 83 }, { LEN: 1501, ARP: 3, TEID: 0x25 }),
    pkt(6, 'SLICE_EMBB', '1500 B — exactly at the limit', { SST: 1, FIVEQI: 8 }, { LEN: 1500, ARP: 9, TEID: 0x26 }),
    pkt(7, 'DROP', '4096 B — oversized sensor dump', { SST: 3, FIVEQI: 6 }, { LEN: 4096, ARP: 11, TEID: 0x27 }),
    pkt(8, 'SLICE_URLLC', '64 B actuator command', { SST: 2, FIVEQI: 82 }, { LEN: 64, ARP: 1, TEID: 0x28 }),
    pkt(9, 'SLICE_MMTC', '128 B firmware ping', { SST: 3, FIVEQI: 7 }, { LEN: 128, ARP: 13, TEID: 0x29 }),
    pkt(10, 'SLICE_EMBB', '900 B page fetch', { SST: 1, FIVEQI: 9 }, { LEN: 900, ARP: 8, TEID: 0x2a }),
  ],
  par: { size: 20, speed: 113 },
  hints: [
    'GETW R1, #1 loads the meta word. Length is the top 16 bits, so SHR R1, #16 — no mask needed above it.',
    '1500 is allowed and 1501 is not, so the test is JGT against #1500, not JGE.',
    'Check the length before you touch SST. An oversized packet drops regardless of which slice asked for it.',
  ],
  reference: `loop:
  JEMPTY done
  IN R0
  GETW R1, #1
  SHR R1, #16
  CMP R1, #1500
  JGT drop
  SHR R0, #24
  CMP R0, #SST_URLLC
  JZ urllc
  CMP R0, #SST_MMTC
  JZ mmtc
  EMIT SLICE_EMBB
  JMP loop
drop:
  EMIT DROP
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
  starter: `; WO-1157 — MTU is 1500. Read the meta word with GETW.
loop:
  JEMPTY done
  IN R0

  ; length gate first, then SST

  JMP loop
done:
  HALT
`,
};
