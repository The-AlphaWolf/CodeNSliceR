/** Assemble-time and run-time error plumbing, shaped for Monaco markers. */

export interface Diagnostic {
  /** 1-based source line. */
  line: number;
  /** 1-based column of the first offending character. */
  col: number;
  /** 1-based column just past the offending text. */
  endCol: number;
  message: string;
  severity: 'error' | 'warning';
}

export function err(line: number, col: number, endCol: number, message: string): Diagnostic {
  return { line, col, endCol, message, severity: 'error' };
}

/** Thrown by the VM while executing. Carries the source line so the UI can point at it. */
export class RuntimeFault extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly pc: number,
  ) {
    super(message);
    this.name = 'RuntimeFault';
  }
}
