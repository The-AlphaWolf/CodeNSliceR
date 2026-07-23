/**
 * Monaco wiring for the CN-SliceR assembly dialect: syntax highlighting, a CRT
 * theme, hover docs pulled straight from the ISA table, and completions that only
 * offer instructions the current level has unlocked.
 */

import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { MNEMONICS, OPS } from '@/vm/isa';
import { BINS, NAMED_CONSTANTS } from '@/vm/packets';

export const LANGUAGE_ID = 'nslice';
export const THEME_ID = 'cn-terminal';

/** Updated by the editor whenever the level changes, so completions stay honest. */
let allowedOps = new Set<string>(MNEMONICS);

export function setAllowedOps(ops: readonly string[]): void {
  allowedOps = new Set(ops);
}

let registered = false;

export function registerNsliceLanguage(monaco: typeof Monaco): void {
  if (registered) return;
  registered = true;

  monaco.languages.register({ id: LANGUAGE_ID });

  monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, {
    ignoreCase: true,
    defaultToken: '',
    mnemonics: MNEMONICS,
    bins: [...BINS],
    constants: Object.keys(NAMED_CONSTANTS).filter((c) => !(BINS as readonly string[]).includes(c)),
    tokenizer: {
      root: [
        [/;.*$/, 'comment'],
        [/^\s*[A-Za-z_]\w*\s*:/, 'type.identifier'],
        [/\b[Rr][0-7]\b/, 'variable.predefined'],
        [/#?0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/#?0[bB][01]+/, 'number.binary'],
        [/#\d+/, 'number'],
        [/\b\d+\b/, 'number'],
        [
          /#?[A-Za-z_]\w*/,
          {
            cases: {
              '@mnemonics': 'keyword',
              '@bins': 'constant',
              '@constants': 'constant',
              '@default': 'identifier',
            },
          },
        ],
        [/[[\]]/, 'delimiter.bracket'],
        [/,/, 'delimiter'],
      ],
    },
  } as Monaco.languages.IMonarchLanguage);

  monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
    comments: { lineComment: ';' },
    brackets: [['[', ']']],
    autoClosingPairs: [{ open: '[', close: ']' }],
  });

  monaco.editor.defineTheme(THEME_ID, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'cfe8dd' },
      { token: 'comment', foreground: '5c7a70', fontStyle: 'italic' },
      { token: 'keyword', foreground: '4ade80', fontStyle: 'bold' },
      { token: 'variable.predefined', foreground: '22d3ee' },
      { token: 'constant', foreground: 'c084fc' },
      { token: 'number', foreground: 'fbbf24' },
      { token: 'number.hex', foreground: 'fbbf24' },
      { token: 'number.binary', foreground: 'fbbf24' },
      { token: 'type.identifier', foreground: 'f0abfc' },
      { token: 'identifier', foreground: 'cfe8dd' },
      { token: 'delimiter', foreground: '6f8a80' },
      { token: 'delimiter.bracket', foreground: '6f8a80' },
    ],
    colors: {
      'editor.background': '#080d0c',
      'editor.foreground': '#cfe8dd',
      'editorLineNumber.foreground': '#3d5750',
      'editorLineNumber.activeForeground': '#8fd4b4',
      'editor.lineHighlightBackground': '#0f1a17',
      'editorCursor.foreground': '#4ade80',
      'editor.selectionBackground': '#1d3a31',
      'editorGutter.background': '#080d0c',
      'editorError.foreground': '#f87171',
      'editorWidget.background': '#0c1412',
      'editorWidget.border': '#1b2a26',
      'editorSuggestWidget.background': '#0c1412',
      'editorSuggestWidget.border': '#1b2a26',
      'editorSuggestWidget.selectedBackground': '#1d3a31',
      'editorHoverWidget.background': '#0c1412',
      'editorHoverWidget.border': '#1b2a26',
    },
  });

  monaco.languages.registerHoverProvider(LANGUAGE_ID, {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const upper = word.word.toUpperCase();

      const op = OPS[upper];
      if (op) {
        const locked = !allowedOps.has(upper);
        return {
          range: wordRange(monaco, position, word),
          contents: [
            { value: `**${op.mnemonic}** — ${op.summary}` },
            { value: '```\n' + op.syntax + '\n```' },
            { value: op.detail },
            {
              value: `_${op.cycles} cycle${op.cycles === 1 ? '' : 's'}${
                op.setsFlags ? ', sets Z/L' : ''
              }_${locked ? '\n\n**Not unlocked on this level.**' : ''}`,
            },
          ],
        };
      }

      if (upper in NAMED_CONSTANTS) {
        const value = NAMED_CONSTANTS[upper];
        const isBin = (BINS as readonly string[]).includes(upper);
        return {
          range: wordRange(monaco, position, word),
          contents: [
            { value: `**${upper}** = ${value}` },
            {
              value: isBin
                ? 'Slice bin. Usable directly with EMIT, or as an immediate for EMITR.'
                : 'Standardized SST value.',
            },
          ],
        };
      }

      if (/^[Rr][0-7]$/.test(word.word)) {
        return {
          range: wordRange(monaco, position, word),
          contents: [{ value: `**${word.word.toUpperCase()}** — general purpose register, 32-bit unsigned` }],
        };
      }

      return null;
    },
  });

  monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: Monaco.languages.CompletionItem[] = [];

      for (const mnemonic of MNEMONICS) {
        if (!allowedOps.has(mnemonic)) continue;
        const op = OPS[mnemonic];
        suggestions.push({
          label: op.mnemonic,
          kind: monaco.languages.CompletionItemKind.Keyword,
          detail: op.summary,
          documentation: { value: `\`${op.syntax}\`\n\n${op.detail}` },
          insertText: op.mnemonic,
          range,
        });
      }

      for (const bin of BINS) {
        suggestions.push({
          label: bin,
          kind: monaco.languages.CompletionItemKind.Constant,
          detail: `bin index ${NAMED_CONSTANTS[bin]}`,
          insertText: bin,
          range,
        });
      }

      for (const [name, value] of Object.entries(NAMED_CONSTANTS)) {
        if ((BINS as readonly string[]).includes(name)) continue;
        suggestions.push({
          label: name,
          kind: monaco.languages.CompletionItemKind.Constant,
          detail: `= ${value}`,
          insertText: name,
          range,
        });
      }

      for (let i = 0; i < 8; i++) {
        suggestions.push({
          label: `R${i}`,
          kind: monaco.languages.CompletionItemKind.Variable,
          detail: 'register',
          insertText: `R${i}`,
          range,
        });
      }

      // Labels already declared in this program.
      const labels = new Set<string>();
      for (const line of model.getLinesContent()) {
        const m = /^\s*([A-Za-z_]\w*)\s*:/.exec(line);
        if (m) labels.add(m[1]);
      }
      for (const label of labels) {
        suggestions.push({
          label,
          kind: monaco.languages.CompletionItemKind.Reference,
          detail: 'label',
          insertText: label,
          range,
        });
      }

      return { suggestions };
    },
  });
}

function wordRange(
  monaco: typeof Monaco,
  position: Monaco.Position,
  word: Monaco.editor.IWordAtPosition,
): Monaco.IRange {
  return new monaco.Range(
    position.lineNumber,
    word.startColumn,
    position.lineNumber,
    word.endColumn,
  );
}
