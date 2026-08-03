/**
 * Monaco, wired straight to the store. Monaco is used directly rather than through a
 * React wrapper so the editor instance is created exactly once and the worker is
 * bundled locally instead of pulled from a CDN.
 */

import { useEffect, useRef } from 'react';
// The core editor API only — importing 'monaco-editor' would drag in every built-in
// language and language service, none of which this game uses.
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { LANGUAGE_ID, THEME_ID, registerNsliceLanguage, setAllowedOps } from './monaco/nsliceLang';
import { useGame } from '@/state/store';
import { opsForTier } from '@/levels/schema';

// The base editor worker is the only one needed — no TypeScript, JSON or CSS services.
(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

export function EditorPane() {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorations = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);

  const level = useGame((s) => s.level);
  const source = useGame((s) => s.source);
  const program = useGame((s) => s.program);
  const vmState = useGame((s) => s.vmState);
  const breakpoints = useGame((s) => s.breakpoints);

  // Create the editor once.
  useEffect(() => {
    if (!host.current) return;
    registerNsliceLanguage(monaco);

    const instance = monaco.editor.create(host.current, {
      value: useGame.getState().source,
      language: LANGUAGE_ID,
      theme: THEME_ID,
      automaticLayout: true,
      fontFamily:
        '"JetBrains Mono Variable", "JetBrains Mono", "Cascadia Mono", "Consolas", monospace',
      fontSize: 13,
      lineHeight: 20,
      glyphMargin: true,
      lineNumbers: (n) => String(n).padStart(2, '0'),
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderLineHighlight: 'line',
      roundedSelection: false,
      tabSize: 2,
      wordBasedSuggestions: 'off',
      quickSuggestions: { other: true, comments: false, strings: false },
      padding: { top: 10, bottom: 10 },
    });

    editor.current = instance;
    decorations.current = instance.createDecorationsCollection();

    // Monaco measures the glyph box once, at creation. If JetBrains Mono is still
    // loading then, every column is measured against the fallback and the cursor
    // drifts from the text once the swap lands.
    void document.fonts.ready.then(() => monaco.editor.remeasureFonts());

    const changeSub = instance.onDidChangeModelContent(() => {
      useGame.getState().setSource(instance.getValue());
    });

    // Clicking the glyph margin toggles a breakpoint on that line.
    const mouseSub = instance.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const line = e.target.position?.lineNumber;
        if (line) useGame.getState().toggleBreakpoint(line);
      }
    });

    return () => {
      changeSub.dispose();
      mouseSub.dispose();
      instance.dispose();
      editor.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push external source changes (level switch, reference load) into the model without
  // stomping the cursor when the change originated from typing.
  useEffect(() => {
    const instance = editor.current;
    if (!instance) return;
    if (instance.getValue() !== source) instance.setValue(source);
  }, [source]);

  useEffect(() => {
    setAllowedOps(opsForTier(level.tier));
  }, [level]);

  // Assembler diagnostics become squiggles.
  useEffect(() => {
    const instance = editor.current;
    const model = instance?.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(
      model,
      'nslice',
      program.diagnostics.map((d) => ({
        startLineNumber: d.line,
        endLineNumber: d.line,
        startColumn: d.col,
        endColumn: d.endCol,
        message: d.message,
        severity:
          d.severity === 'error'
            ? monaco.MarkerSeverity.Error
            : monaco.MarkerSeverity.Warning,
      })),
    );
  }, [program]);

  // Current-line highlight and breakpoint glyphs.
  useEffect(() => {
    const collection = decorations.current;
    if (!collection) return;

    const next: monaco.editor.IModelDeltaDecoration[] = breakpoints.map((line) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: 'cn-breakpoint',
        glyphMarginHoverMessage: { value: 'Breakpoint — the run pauses before this line' },
      },
    }));

    const instr = program.instrs[vmState.pc];
    if (instr && !vmState.halted) {
      next.push({
        range: new monaco.Range(instr.line, 1, instr.line, 1),
        options: {
          isWholeLine: true,
          className: 'cn-current-line',
          glyphMarginClassName: 'cn-current-arrow',
        },
      });
    }
    if (vmState.faultLine) {
      next.push({
        range: new monaco.Range(vmState.faultLine, 1, vmState.faultLine, 1),
        options: { isWholeLine: true, className: 'cn-fault-line' },
      });
    }

    collection.set(next);
  }, [breakpoints, program, vmState]);

  return (
    <div className="editor-card">
      <div className="editor-title">
        <span>slice_rules.asm</span>
        <em>{program.instrs.length} instr</em>
      </div>
      <div className="editor-host" ref={host} data-testid="editor" />
    </div>
  );
}

/** Jump the editor to a line — used by the result modal to point at a fault. */
export function revealLine(line: number): void {
  const instance = monaco.editor.getEditors()[0];
  instance?.revealLineInCenter(line);
  instance?.setPosition({ lineNumber: line, column: 1 });
  instance?.focus();
}
