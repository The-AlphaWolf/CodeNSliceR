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
    // DROP reads as the destructive outcome it is, so it gets its own colour.
    drops: ['DROP'],
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
              '@drops': 'constant.drop',
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
      { token: '', foreground: 'cfe8e2' },
      { token: 'comment', foreground: '4d7a72', fontStyle: 'italic' },
      { token: 'keyword', foreground: '5eead4' },
      { token: 'variable.predefined', foreground: 'cfe8e2' },
      { token: 'constant', foreground: '2ee6a0' },
      { token: 'constant.drop', foreground: 'e05263' },
      { token: 'number', foreground: 'a5d6cd' },
      { token: 'number.hex', foreground: 'a5d6cd' },
      { token: 'number.binary', foreground: 'a5d6cd' },
      { token: 'type.identifier', foreground: 'e6f4f0' },
      { token: 'identifier', foreground: 'cfe8e2' },
      { token: 'delimiter', foreground: '6d918a' },
      { token: 'delimiter.bracket', foreground: '6d918a' },
    ],
    colors: {
      'editor.background': '#071a18',
      'editor.foreground': '#cfe8e2',
      'editorLineNumber.foreground': '#3a5f59',
      'editorLineNumber.activeForeground': '#5eead4',
      'editor.lineHighlightBackground': '#0a231f',
      'editorCursor.foreground': '#2ee6a0',
      'editor.selectionBackground': '#16403a',
      'editorGutter.background': '#071a18',
      'editorError.foreground': '#e05263',
      'editorWidget.background': '#0a231f',
      'editorWidget.border': '#16403a',
      'editorSuggestWidget.background': '#0a231f',
      'editorSuggestWidget.border': '#16403a',
      'editorSuggestWidget.selectedBackground': '#16403a',
      'editorHoverWidget.background': '#0a231f',
      'editorHoverWidget.border': '#16403a',
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
