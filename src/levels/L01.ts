import { Level, pkt } from './schema';

export const L01: Level = {
  id: '01',
  num: 1,
  title: 'First Hop',
  ticket: 'WO-1001 — bring the classifier online',
  brief: [
    'Welcome to the packet core. Traffic arrives on the ingress queue; your job is to move every packet into a slice before the queue drains.',
    'Only one slice is provisioned on this link today, so there is nothing to decide yet. Learn the loop: check whether the queue is empty, pull a packet, emit it, repeat.',
    'IN pulls the next packet into the packet buffer. EMIT moves the buffered packet into a slice. Pull without emitting and the machine faults — one packet in the buffer at a time.',
  ],
  rules: ['Every packet goes to SLICE_EMBB.'],
  bins: ['SLICE_EMBB'],
  tier: 1,
  focusFields: [],
  glossary: ['slice', 'embb'],
  packets: [
    pkt(1, 'SLICE_EMBB', '4K video stream', { SST: 1, FIVEQI: 9, DSCP: 0 }),
    pkt(2, 'SLICE_EMBB', 'Software update', { SST: 1, FIVEQI: 8, DSCP: 0 }),
    pkt(3, 'SLICE_EMBB', 'Web browsing', { SST: 1, FIVEQI: 9, DSCP: 0 }),
    pkt(4, 'SLICE_EMBB', 'Cloud photo sync', { SST: 1, FIVEQI: 8, DSCP: 0 }),
    pkt(5, 'SLICE_EMBB', 'Podcast download', { SST: 1, FIVEQI: 9, DSCP: 0 }),
  ],
  par: { size: 5, speed: 22 },
  hints: [
    'JEMPTY jumps only when the ingress queue has nothing left. Put it at the top of your loop so you stop pulling once the queue is dry.',
    'The body of the loop is three instructions: IN, EMIT, JMP back to the top.',
    'Label a line by writing name: on its own line. JMP loop sends the program counter back to whatever instruction follows loop:.',
  ],
  reference: `loop:
  JEMPTY done
  IN R0
  EMIT SLICE_EMBB
  JMP loop
done:
  HALT
`,
  starter: `; WO-1001 — everything goes to the broadband slice.
loop:
  JEMPTY done
  IN R0

  ; emit the packet here

  JMP loop
done:
  HALT
`,
};
