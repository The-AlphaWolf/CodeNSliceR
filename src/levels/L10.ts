import { Level, pkt } from './schema';

export const L10: Level = {
  id: '10',
  num: 10,
  title: 'Tenant Split',
  ticket: 'WO-1124 — carve a private slice out of eMBB',
  brief: [
    'S-NSSAI is not just the SST. The Slice Differentiator underneath it names a tenant, so two subscribers can share a slice type and still be told apart.',
    'A stadium operator has bought a private low-latency instance inside the broadband slice type. Their SD is 0x10. Same SST as everyone else, different destination.',
    'SD lives at bits 23..16 — squarely in the middle of the word, so it needs both a shift and a mask, and you need to grab it before you flatten the header down to SST.',
  ],
  rules: [
    'SST 1 with SD 0x10 goes to SLICE_URLLC.',
    'SST 1 with any other SD goes to SLICE_EMBB.',
    'SST 3 goes to SLICE_MMTC.',
    'SST 4 goes to SLICE_V2X.',
  ],
  bins: ['SLICE_EMBB', 'SLICE_URLLC', 'SLICE_MMTC', 'SLICE_V2X'],
  tier: 7,
  focusFields: ['SST', 'SD'],
  glossary: ['snssai', 'sd', 'sst', 'v2x'],
  packets: [
    pkt(1, 'SLICE_EMBB', 'Public broadband, SD 0x01', { SST: 1, SD: 0x01, FIVEQI: 9 }),
    pkt(2, 'SLICE_URLLC', 'Stadium tenant, SD 0x10', { SST: 1, SD: 0x10, FIVEQI: 9 }),
    pkt(3, 'SLICE_MMTC', 'Water meter', { SST: 3, SD: 0x02, FIVEQI: 7 }),
    pkt(4, 'SLICE_URLLC', 'Stadium replay camera, SD 0x10', { SST: 1, SD: 0x10, FIVEQI: 8 }),
    pkt(5, 'SLICE_V2X', 'Roadside unit', { SST: 4, SD: 0x03, FIVEQI: 75 }),
    pkt(6, 'SLICE_EMBB', 'Public broadband, SD 0x11', { SST: 1, SD: 0x11, FIVEQI: 9 }),
    pkt(7, 'SLICE_MMTC', 'Streetlight, SD 0x10 but SST 3', { SST: 3, SD: 0x10, FIVEQI: 6 }),
    pkt(8, 'SLICE_EMBB', 'Public broadband, SD 0x00', { SST: 1, SD: 0x00, FIVEQI: 8 }),
    pkt(9, 'SLICE_V2X', 'Platooning beacon, SD 0x10 but SST 4', { SST: 4, SD: 0x10, FIVEQI: 76 }),
    pkt(10, 'SLICE_URLLC', 'Stadium tenant, SD 0x10', { SST: 1, SD: 0x10, FIVEQI: 1 }),
  ],
  par: { size: 21, speed: 130 },
  hints: [
    'Copy the header to a scratch register first. One copy becomes SD, the other becomes SST.',
    'SD: SHR by 16, then AND #0xFF. SST: SHR by 24, no mask needed.',
    'Packets 7 and 9 carry SD 0x10 on a different SST. Check SST before you let SD decide anything.',
  ],
  reference: `loop:
  JEMPTY done
  IN R0
  MOV R1, R0
  SHR R1, #16
  AND R1, #0xFF
  SHR R0, #24
  CMP R0, #SST_MMTC
  JZ mmtc
  CMP R0, #SST_V2X
  JZ v2x
  CMP R1, #0x10
  JZ urllc
  EMIT SLICE_EMBB
  JMP loop
urllc:
  EMIT SLICE_URLLC
  JMP loop
mmtc:
  EMIT SLICE_MMTC
  JMP loop
v2x:
  EMIT SLICE_V2X
  JMP loop
done:
  HALT
`,
  starter: `; WO-1124 — SD 0x10 on SST 1 is the stadium's private slice.
loop:
  JEMPTY done
  IN R0

  ; pull SD out of bits 23..16 before you destroy it

  JMP loop
done:
  HALT
`,
};
