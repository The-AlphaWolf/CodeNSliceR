import { Level, pkt } from './schema';

export const L08: Level = {
  id: '08',
  num: 8,
  title: 'Scratch Space',
  ticket: 'WO-1095 — enforce the URLLC admission limit',
  brief: [
    'The URLLC slice is sold with a hard admission limit: three bearers, no more. The fourth low-latency request of the shift is not rejected outright, it degrades onto the broadband slice.',
    'That means the classifier now has memory. Sixteen RAM cells are wired up; LOAD reads one into a register and STORE writes one back. Both cost two cycles instead of one.',
    'Registers survive across loop iterations too, but RAM is where a counter belongs once you have more than a couple of things to remember.',
  ],
  rules: [
    'SST 3 goes to SLICE_MMTC.',
    'SST 2 goes to SLICE_URLLC — but only the first three. Later SST 2 packets go to SLICE_EMBB.',
    'Everything else goes to SLICE_EMBB.',
  ],
  bins: ['SLICE_EMBB', 'SLICE_URLLC', 'SLICE_MMTC'],
  tier: 6,
  focusFields: ['SST'],
  glossary: ['sst', 'urllc', 'admission'],
  packets: [
    pkt(1, 'SLICE_URLLC', 'URLLC #1 — admitted', { SST: 2, FIVEQI: 82 }),
    pkt(2, 'SLICE_EMBB', 'Video stream', { SST: 1, FIVEQI: 9 }),
    pkt(3, 'SLICE_URLLC', 'URLLC #2 — admitted', { SST: 2, FIVEQI: 83 }),
    pkt(4, 'SLICE_MMTC', 'Water meter', { SST: 3, FIVEQI: 7 }),
    pkt(5, 'SLICE_URLLC', 'URLLC #3 — admitted, slice now full', { SST: 2, FIVEQI: 82 }),
    pkt(6, 'SLICE_EMBB', 'URLLC #4 — over limit, degrades', { SST: 2, FIVEQI: 82 }),
    pkt(7, 'SLICE_MMTC', 'Parking sensor', { SST: 3, FIVEQI: 6 }),
    pkt(8, 'SLICE_EMBB', 'URLLC #5 — over limit, degrades', { SST: 2, FIVEQI: 83 }),
    pkt(9, 'SLICE_EMBB', 'Cloud backup', { SST: 1, FIVEQI: 8 }),
    pkt(10, 'SLICE_EMBB', 'URLLC #6 — over limit, degrades', { SST: 2, FIVEQI: 82 }),
  ],
  par: { size: 19, speed: 121 },
  hints: [
    'RAM starts zeroed, so cell 0 is already a valid empty counter — no initialisation needed.',
    'On the SST 2 path: LOAD the counter, compare it against 3, and JGE onto the eMBB path when the slice is full.',
    'Only increment and STORE on the path that actually admits a packet. Counting the degraded ones too would close the slice early.',
  ],
  reference: `loop:
  JEMPTY done
  IN R0
  SHR R0, #24
  CMP R0, #SST_MMTC
  JZ mmtc
  CMP R0, #SST_URLLC
  JNZ embb
  LOAD R1, [0]
  CMP R1, #3
  JGE embb
  ADD R1, #1
  STORE [0], R1
  EMIT SLICE_URLLC
  JMP loop
embb:
  EMIT SLICE_EMBB
  JMP loop
mmtc:
  EMIT SLICE_MMTC
  JMP loop
done:
  HALT
`,
  starter: `; WO-1095 — the URLLC slice admits three bearers, then overflows to eMBB.
loop:
  JEMPTY done
  IN R0

  ; keep the admission count in RAM cell 0

  JMP loop
done:
  HALT
`,
};
