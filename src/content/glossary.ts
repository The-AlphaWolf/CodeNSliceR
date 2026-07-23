/**
 * The codex. Every 5G term the game uses, in plain English, with an honest note
 * wherever CodeNSliceR simplifies what a real network does.
 */

export interface GlossaryEntry {
  id: string;
  term: string;
  /** Expansion of the acronym, where there is one. */
  expansion?: string;
  body: string;
  /** Where the game bends reality, if it does. */
  simplification?: string;
  /** Level ids that lean on this term. */
  levels: string[];
  related: string[];
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'slice',
    term: 'Network slice',
    body: 'One physical 5G network, carved into several logical networks that share the same radio and transport but get their own capacity, latency targets and policies. A factory, a stadium and a fleet of water meters can all sit on the same tower and never notice each other.',
    levels: ['01', '02', '09'],
    related: ['snssai', 'sst', 'embb', 'urllc', 'mmtc'],
  },
  {
    id: 'snssai',
    term: 'S-NSSAI',
    expansion: 'Single Network Slice Selection Assistance Information',
    body: 'The identifier that names one slice. It is two parts: an SST saying what kind of slice it is, and an optional SD saying which tenant instance of that kind. The UE asks for one, the core decides whether it gets it.',
    simplification:
      'A real S-NSSAI is 8 bits of SST plus 24 bits of SD. Here SD is squeezed to 8 bits so the whole header fits in one word.',
    levels: ['10', '15'],
    related: ['sst', 'sd', 'slice'],
  },
  {
    id: 'sst',
    term: 'SST',
    expansion: 'Slice/Service Type',
    body: 'The kind of slice. Four values are standardized so that a device roaming onto any operator gets something recognisable: 1 = eMBB, 2 = URLLC, 3 = mMTC, 4 = V2X. Values above those are operator-specific.',
    levels: ['02', '04', '08', '09', '10', '12', '13', '14', '15'],
    related: ['snssai', 'sd', 'embb', 'urllc', 'mmtc', 'v2x'],
  },
  {
    id: 'sd',
    term: 'SD',
    expansion: 'Slice Differentiator',
    body: 'Optional tenant tag under the SST. Two customers can both buy an eMBB slice and be told apart by SD, which is how a stadium gets a private instance without the operator inventing a new slice type.',
    simplification: 'Truncated from 24 bits to 8 in this game.',
    levels: ['10', '15'],
    related: ['snssai', 'sst'],
  },
  {
    id: 'embb',
    term: 'eMBB',
    expansion: 'Enhanced Mobile Broadband',
    body: 'The throughput slice. Video, downloads, browsing, anything where more megabits is the whole point and a few extra milliseconds nobody notices.',
    levels: ['01', '02', '03', '04'],
    related: ['sst', 'slice'],
  },
  {
    id: 'urllc',
    term: 'URLLC',
    expansion: 'Ultra-Reliable Low-Latency Communication',
    body: 'The slice that trades bandwidth for determinism. Targets are on the order of one millisecond of user-plane latency at 99.999% reliability — motion control, grid protection, remote operation.',
    levels: ['03', '04', '05', '07', '08', '13', '15'],
    related: ['sst', 'fiveqi', 'gbr'],
  },
  {
    id: 'mmtc',
    term: 'mMTC',
    expansion: 'Massive Machine-Type Communications',
    body: 'The slice for enormous numbers of tiny devices. Meters, sensors, trackers — each sending a few bytes rarely, but a million of them per square kilometre, and expected to run years on one battery.',
    levels: ['05', '08', '13'],
    related: ['sst', 'ue'],
  },
  {
    id: 'v2x',
    term: 'V2X',
    expansion: 'Vehicle-to-Everything',
    body: 'Cars talking to other cars, to roadside units, to pedestrians’ phones, and to the network. Collision warnings and platooning have latency budgets that look like URLLC but a mobility pattern that looks like nothing else.',
    levels: ['09', '10', '11', '14', '15'],
    related: ['sst', 'urllc'],
  },
  {
    id: 'fiveqi',
    term: '5QI',
    expansion: '5G QoS Identifier',
    body: 'A single number that stands in for a whole quality-of-service profile: resource type, priority level, packet delay budget, packet error rate. 5QI 1 is conversational voice; 82 is discrete automation with a 10 ms budget; 9 is default best-effort broadband. The point is that both ends already agree what the number means, so it never has to be negotiated.',
    simplification:
      'The LTE ancestor of this field is QCI. The value ranges here (1..9, 65..85) match the real standardized tables.',
    levels: ['03', '07'],
    related: ['gbr', 'urllc', 'arp'],
  },
  {
    id: 'gbr',
    term: 'GBR',
    expansion: 'Guaranteed Bit Rate',
    body: 'A bearer flag. GBR bearers get capacity reserved for them and are admission-controlled — the network either promises the rate or refuses the bearer. Non-GBR bearers share whatever is left and degrade gracefully under load.',
    levels: ['05', '06'],
    related: ['fiveqi', 'admission'],
  },
  {
    id: 'arp',
    term: 'ARP',
    expansion: 'Allocation and Retention Priority',
    body: 'Priority level 1 to 15 deciding who wins when the network is out of room, plus flags for whether a bearer may pre-empt others or be pre-empted itself. Lower numbers are more important, which catches everyone out at least once. Levels 1 to 4 are typically reserved for emergency and network services.',
    levels: ['13', '14', '15'],
    related: ['fiveqi', 'admission'],
  },
  {
    id: 'dscp',
    term: 'DSCP',
    expansion: 'Differentiated Services Code Point',
    body: 'Six bits in the IP header that mark how a packet should be treated hop by hop. EF (46) is expedited forwarding, the classic voice marking. AF41 (34) is assured forwarding for interactive traffic. 0 is default. The 5G core often maps DSCP onto its own QoS flows rather than trusting it blindly.',
    levels: ['11', '15'],
    related: ['fiveqi', 'rqi'],
  },
  {
    id: 'rqi',
    term: 'RQI',
    expansion: 'Reflective QoS Indicator',
    body: 'A single bit telling the device: whatever QoS rule I used for this downlink packet, apply the mirror of it to your uplink traffic in the same flow. It saves the network from signalling an explicit uplink rule for every flow.',
    levels: ['11'],
    related: ['dscp', 'fiveqi'],
  },
  {
    id: 'teid',
    term: 'TEID',
    expansion: 'Tunnel Endpoint Identifier',
    body: 'The number that identifies one GTP-U tunnel between the base station and the user plane function. User traffic in 5G is encapsulated in these tunnels, which is why the transport MTU matters — the tunnel headers eat into it.',
    simplification: 'A real TEID is 32 bits. Only the low byte is carried here.',
    levels: ['12'],
    related: ['mtu'],
  },
  {
    id: 'mtu',
    term: 'MTU',
    expansion: 'Maximum Transmission Unit',
    body: 'The largest frame the transport network will carry without fragmenting it. Encapsulation shrinks the budget available to user payload, so an edge classifier that discards oversized packets early saves everyone downstream the trouble.',
    levels: ['12', '14', '15'],
    related: ['teid'],
  },
  {
    id: 'ue',
    term: 'UE',
    expansion: 'User Equipment',
    body: 'Anything attached to the network: a phone, a car, a meter, a robot arm. UE category is a rough statement of what the device is capable of, which the network uses to decide what to offer it.',
    levels: ['12'],
    related: ['mmtc'],
  },
  {
    id: 'admission',
    term: 'Admission control',
    body: 'The decision to accept or refuse a new bearer based on whether the slice still has capacity to honour its promises. A slice that accepted every request would break the guarantee it was sold on, so the overflow either gets refused or degraded onto a best-effort slice.',
    levels: ['08', '15'],
    related: ['gbr', 'arp', 'slice'],
  },
];

export const GLOSSARY_BY_ID: Record<string, GlossaryEntry> = Object.fromEntries(
  GLOSSARY.map((g) => [g.id, g]),
);
