/**
 * Single source of truth for the CN-SliceR packet format.
 *
 * Everything downstream reads from here: the assembler's constant table, the level
 * definitions, the bit-grid UI, and the glossary cross-references. Change a field
 * offset here and the whole game follows.
 *
 * The layout is "real-ish": the field names, meanings and value ranges are taken
 * from 3GPP 5G System specs, but some widths are truncated so a whole packet
 * descriptor fits in two 32-bit words that a player can reasonably shift and mask.
 */

export type WordIndex = 0 | 1;

export interface FieldDef {
  /** Symbolic name, e.g. "SST". */
  name: string;
  /** Which packet word the field lives in. 0 = header, 1 = meta. */
  word: WordIndex;
  /** Bit position of the least significant bit of the field. */
  offset: number;
  /** Field width in bits. */
  width: number;
  /** Human label used in the bit grid. */
  label: string;
  /** One-line plain-English meaning. */
  blurb: string;
  /** Glossary term id this field maps to, if any. */
  glossary?: string;
}

/** Header word (word 0) bit layout, MSB first. */
export const HEADER_FIELDS: FieldDef[] = [
  {
    name: 'SST',
    word: 0,
    offset: 24,
    width: 8,
    label: 'SST',
    blurb: 'Slice/Service Type. 1=eMBB 2=URLLC 3=mMTC 4=V2X',
    glossary: 'sst',
  },
  {
    name: 'SD',
    word: 0,
    offset: 16,
    width: 8,
    label: 'SD',
    blurb: 'Slice Differentiator — tenant id inside a slice type',
    glossary: 'sd',
  },
  {
    name: 'FIVEQI',
    word: 0,
    offset: 8,
    width: 8,
    label: '5QI',
    blurb: 'QoS Identifier. Picks a standardized latency/loss profile',
    glossary: 'fiveqi',
  },
  {
    name: 'DSCP',
    word: 0,
    offset: 2,
    width: 6,
    label: 'DSCP',
    blurb: 'IP DiffServ codepoint carried up from the transport layer',
    glossary: 'dscp',
  },
  {
    name: 'RQI',
    word: 0,
    offset: 1,
    width: 1,
    label: 'RQI',
    blurb: 'Reflective QoS Indicator — mirror this mapping on the uplink',
    glossary: 'rqi',
  },
  {
    name: 'GBR',
    word: 0,
    offset: 0,
    width: 1,
    label: 'GBR',
    blurb: 'Guaranteed Bit Rate bearer flag',
    glossary: 'gbr',
  },
];

/** Meta word (word 1) bit layout, MSB first. */
export const META_FIELDS: FieldDef[] = [
  {
    name: 'LEN',
    word: 1,
    offset: 16,
    width: 16,
    label: 'LEN',
    blurb: 'Payload length in bytes',
  },
  {
    name: 'ARP',
    word: 1,
    offset: 12,
    width: 4,
    label: 'ARP',
    blurb: 'Allocation & Retention Priority level, 1..15. Lower = more important',
    glossary: 'arp',
  },
  {
    name: 'UECAT',
    word: 1,
    offset: 8,
    width: 4,
    label: 'UECAT',
    blurb: 'UE category — the class of device that sent this packet',
    glossary: 'ue',
  },
  {
    name: 'TEID',
    word: 1,
    offset: 0,
    width: 8,
    label: 'TEID',
    blurb: 'Low byte of the GTP-U Tunnel Endpoint Identifier',
    glossary: 'teid',
  },
];

export const ALL_FIELDS: FieldDef[] = [...HEADER_FIELDS, ...META_FIELDS];

export const FIELD_BY_NAME: Record<string, FieldDef> = Object.fromEntries(
  ALL_FIELDS.map((f) => [f.name, f]),
);

// ---------------------------------------------------------------------------
// Slice bins
// ---------------------------------------------------------------------------

/**
 * Global bin vocabulary. The index doubles as the value used by `EMITR`, so it is
 * stable across every level — a level only decides which of these are provisioned.
 */
export const BINS = ['SLICE_EMBB', 'SLICE_URLLC', 'SLICE_MMTC', 'SLICE_V2X', 'DROP'] as const;

export type BinName = (typeof BINS)[number];

export const BIN_INDEX: Record<BinName, number> = Object.fromEntries(
  BINS.map((b, i) => [b, i]),
) as Record<BinName, number>;

export const BIN_LABEL: Record<BinName, string> = {
  SLICE_EMBB: 'eMBB',
  SLICE_URLLC: 'URLLC',
  SLICE_MMTC: 'mMTC',
  SLICE_V2X: 'V2X',
  DROP: 'DROP',
};

export const BIN_BLURB: Record<BinName, string> = {
  SLICE_EMBB: 'Enhanced Mobile Broadband — video, downloads, anything hungry for throughput',
  SLICE_URLLC: 'Ultra-Reliable Low-Latency — control loops, remote surgery, factory robots',
  SLICE_MMTC: 'Massive Machine-Type Comms — swarms of tiny, chatty, low-rate sensors',
  SLICE_V2X: 'Vehicle-to-Everything — cars talking to each other and to roadside units',
  DROP: 'Discard. Malformed, over-MTU, or not entitled to any provisioned slice',
};

// ---------------------------------------------------------------------------
// Assembler-visible named constants
// ---------------------------------------------------------------------------

/**
 * Symbols usable anywhere an immediate is legal. Bin names resolve to their global
 * index so `EMIT SLICE_URLLC` and `MOV R0, #SLICE_URLLC` / `EMITR R0` agree.
 */
export const NAMED_CONSTANTS: Record<string, number> = {
  ...Object.fromEntries(BINS.map((b, i) => [b, i])),
  SST_EMBB: 1,
  SST_URLLC: 2,
  SST_MMTC: 3,
  SST_V2X: 4,
};

// ---------------------------------------------------------------------------
// Encode / decode helpers
// ---------------------------------------------------------------------------

export const U32 = 0x1_0000_0000;

/** Force a JS number into unsigned 32-bit range. */
export function u32(n: number): number {
  return n >>> 0;
}

export function mask(width: number): number {
  return width >= 32 ? 0xffffffff : ((1 << width) - 1) >>> 0;
}

/** Read a named field out of a packet word pair. */
export function getField(words: readonly [number, number], name: string): number {
  const f = FIELD_BY_NAME[name];
  if (!f) throw new Error(`unknown packet field: ${name}`);
  return (words[f.word] >>> f.offset) & mask(f.width);
}

/** Build a word from named field values. Values wider than the field are rejected. */
function packWord(fields: FieldDef[], values: Record<string, number>): number {
  let word = 0;
  for (const [name, value] of Object.entries(values)) {
    const f = fields.find((x) => x.name === name);
    if (!f) throw new Error(`field ${name} does not live in this word`);
    const m = mask(f.width);
    if ((value & ~m) !== 0 || value < 0) {
      throw new Error(`value ${value} does not fit in ${f.width}-bit field ${name}`);
    }
    word = u32(word | ((value & m) << f.offset));
  }
  return u32(word);
}

export interface HeaderSpec {
  SST: number;
  SD?: number;
  FIVEQI?: number;
  DSCP?: number;
  RQI?: number;
  GBR?: number;
}

export interface MetaSpec {
  LEN?: number;
  ARP?: number;
  UECAT?: number;
  TEID?: number;
}

export function encodeHeader(spec: HeaderSpec): number {
  return packWord(HEADER_FIELDS, { SD: 0, FIVEQI: 0, DSCP: 0, RQI: 0, GBR: 0, ...spec });
}

export function encodeMeta(spec: MetaSpec = {}): number {
  return packWord(META_FIELDS, { LEN: 0, ARP: 0, UECAT: 0, TEID: 0, ...spec });
}

export function decodeWords(words: readonly [number, number]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of ALL_FIELDS) out[f.name] = (words[f.word] >>> f.offset) & mask(f.width);
  return out;
}

/** Zero-padded hex, e.g. 0x0102_0304 -> "01020304". */
export function hex32(n: number): string {
  return u32(n).toString(16).padStart(8, '0').toUpperCase();
}

/** 32-character binary string, MSB first. */
export function bin32(n: number): string {
  return u32(n).toString(2).padStart(32, '0');
}
