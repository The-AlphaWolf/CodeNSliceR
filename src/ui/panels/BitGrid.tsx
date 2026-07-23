import { useGame } from '@/state/store';
import {
  FieldDef,
  HEADER_FIELDS,
  META_FIELDS,
  bin32,
  hex32,
  mask,
} from '@/vm/packets';

/**
 * The teaching panel: the buffered packet drawn as a labelled bitfield, MSB on the
 * left. Fields the level cares about are lit; everything else stays dim, so the shape
 * of the word the player is about to shift is never a mystery.
 */
export function BitGrid() {
  const vmState = useGame((s) => s.vmState);
  const level = useGame((s) => s.level);
  const focus = new Set(level.focusFields);

  const buffered = vmState.buffer;
  const next = level.packets[vmState.ingressPos];
  const packet = buffered ?? next ?? null;
  const label = buffered
    ? `packet #${buffered.id} — in buffer`
    : next
      ? `packet #${next.id} — next on ingress`
      : 'queue drained';

  const words: [number, number] = packet ? packet.words : [0, 0];

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Packet</h2>
        <span className={`panel-note${buffered ? ' note-live' : ''}`}>{label}</span>
      </header>

      <WordRow
        title="header"
        word={words[0]}
        fields={HEADER_FIELDS}
        focus={focus}
        active={packet !== null}
      />
      <WordRow
        title="meta"
        word={words[1]}
        fields={META_FIELDS}
        focus={focus}
        active={packet !== null}
      />

      {packet && 'note' in packet && (
        <p className="packet-note">{(packet as { note?: string }).note}</p>
      )}
    </section>
  );
}

function WordRow({
  title,
  word,
  fields,
  focus,
  active,
}: {
  title: string;
  word: number;
  fields: FieldDef[];
  focus: Set<string>;
  active: boolean;
}) {
  const bits = bin32(word);

  return (
    <div className={`word-row${active ? '' : ' word-idle'}`}>
      <div className="word-head">
        <span className="word-title">{title}</span>
        <span className="word-hex">0x{hex32(word)}</span>
      </div>
      <div className="field-strip">
        {fields.map((field) => {
          const value = (word >>> field.offset) & mask(field.width);
          // bin32 is MSB-first, so the field's slice starts at 31 - msb of the field.
          const start = 31 - (field.offset + field.width - 1);
          const slice = bits.slice(start, start + field.width);
          const lit = focus.has(field.name);
          return (
            <div
              key={field.name}
              className={`field${lit ? ' field-lit' : ''}`}
              style={{ flexGrow: field.width }}
              title={`${field.label} — bits ${field.offset + field.width - 1}..${field.offset}\n${field.blurb}`}
            >
              <span className="field-label">{field.label}</span>
              <span className="field-bits">{slice}</span>
              <span className="field-value">{value}</span>
            </div>
          );
        })}
      </div>
      <div className="bit-ruler">
        <span>31</span>
        <span>24</span>
        <span>16</span>
        <span>8</span>
        <span>0</span>
      </div>
    </div>
  );
}
