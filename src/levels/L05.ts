import { Level, pkt } from './schema';

export const L05: Level = {
  id: '05',
  num: 5,
  title: 'Bearer Flags',
  ticket: 'WO-1051 — honour guaranteed bit rate bearers',
  brief: [
    'GBR is a single bit at position 0. A bearer with GBR set has reserved capacity and a hard delay budget, so it belongs on the low-latency slice no matter what slice type the UE asked for.',
    'Testing one bit is the same shift-and-mask trick with a one-bit mask — and since bit 0 is already at the bottom, no shift is needed at all: AND R1, #1.',
    'ALU instructions set the Z flag from their own result, so AND followed directly by JNZ works without a CMP in between.',
  ],
  rules: [
    'GBR set (bit 0 = 1) goes to SLICE_URLLC, whatever the SST says.',
    'Otherwise SST 3 (mMTC) goes to SLICE_MMTC.',
    'Everything else goes to SLICE_EMBB.',
  ],
  bins: ['SLICE_EMBB', 'SLICE_URLLC', 'SLICE_MMTC'],
  tier: 3,
  focusFields: ['GBR', 'SST'],
  glossary: ['gbr', 'mmtc', 'urllc'],
  packets: [
    pkt(1, 'SLICE_EMBB', 'Video stream, non-GBR', { SST: 1, FIVEQI: 9, GBR: 0 }),
    pkt(2, 'SLICE_URLLC', 'Voice bearer, GBR', { SST: 1, FIVEQI: 1, GBR: 1 }),
    pkt(3, 'SLICE_MMTC', 'Water meter, non-GBR', { SST: 3, FIVEQI: 7, GBR: 0 }),
    pkt(4, 'SLICE_URLLC', 'Sensor with reserved rate', { SST: 3, FIVEQI: 3, GBR: 1 }),
    pkt(5, 'SLICE_EMBB', 'File sync, non-GBR', { SST: 1, FIVEQI: 8, GBR: 0 }),
    pkt(6, 'SLICE_URLLC', 'Motion control, GBR', { SST: 2, FIVEQI: 82, GBR: 1 }),
    pkt(7, 'SLICE_EMBB', 'Best-effort URLLC signalling', { SST: 2, FIVEQI: 5, GBR: 0 }),
    pkt(8, 'SLICE_MMTC', 'Smart streetlight', { SST: 3, FIVEQI: 6, GBR: 0 }),
  ],
  par: { size: 15, speed: 73 },
  hints: [
    'Copy the header into a second register with MOV before you start shifting it — you still need the original to read SST afterwards.',
    'AND R1, #1 isolates bit 0 and sets Z at the same time. JNZ takes the GBR path.',
    'Rule order is the program order: test GBR first, and only look at SST on the path where GBR was clear.',
  ],
  reference: `loop:
  JEMPTY done
  IN R0
  MOV R1, R0
  AND R1, #1
  JNZ urllc
  SHR R0, #24
  CMP R0, #SST_MMTC
  JZ mmtc
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
  starter: `; WO-1051 — GBR wins over SST.
loop:
  JEMPTY done
  IN R0

  ; test bit 0, then fall back to SST

  JMP loop
done:
  HALT
`,
};
