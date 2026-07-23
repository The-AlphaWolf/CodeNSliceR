/**
 * localStorage-backed progress. No backend, no accounts — the browser is the save file.
 * Every write is defensive: a corrupt or full store must never take the game down.
 */

import { LEVELS } from '@/levels';

const KEY = 'cn-slicer.progress.v1';

export interface LevelProgress {
  solved: boolean;
  bestSize: number | null;
  bestSpeed: number | null;
  /** Last editor contents, saved as you type. */
  source: string;
  /** How many hints the player has opened. */
  hints: number;
  /** Whether the reference solution has been revealed. */
  revealed: boolean;
}

export interface Progress {
  levels: Record<string, LevelProgress>;
  lastLevel: string;
}

export const EMPTY_LEVEL: LevelProgress = {
  solved: false,
  bestSize: null,
  bestSpeed: null,
  source: '',
  hints: 0,
  revealed: false,
};

export function emptyProgress(): Progress {
  return { levels: {}, lastLevel: '01' };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      levels: parsed.levels ?? {},
      lastLevel: parsed.lastLevel ?? '01',
    };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Private browsing or a full quota. Play on; the run just will not persist.
  }
}

export function levelProgress(progress: Progress, id: string): LevelProgress {
  return progress.levels[id] ?? EMPTY_LEVEL;
}

/** A level is playable once the one before it is solved. */
export function isUnlocked(progress: Progress, id: string): boolean {
  const index = LEVELS.findIndex((l) => l.id === id);
  if (index <= 0) return true;
  return levelProgress(progress, LEVELS[index - 1].id).solved;
}

export function solvedCount(progress: Progress): number {
  return LEVELS.filter((l) => levelProgress(progress, l.id).solved).length;
}

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------

interface ExportBundle {
  format: 'cn-slicer/solutions';
  version: 1;
  exported: string;
  solutions: Record<string, { source: string; size: number | null; speed: number | null }>;
}

export function exportSolutions(progress: Progress): string {
  const solutions: ExportBundle['solutions'] = {};
  for (const level of LEVELS) {
    const p = levelProgress(progress, level.id);
    if (p.source.trim()) {
      solutions[level.id] = { source: p.source, size: p.bestSize, speed: p.bestSpeed };
    }
  }
  const bundle: ExportBundle = {
    format: 'cn-slicer/solutions',
    version: 1,
    exported: new Date().toISOString(),
    solutions,
  };
  return JSON.stringify(bundle, null, 2);
}

export interface ImportOutcome {
  ok: boolean;
  message: string;
  progress?: Progress;
}

/**
 * Merges an exported bundle into existing progress. Imported solutions are not
 * trusted to be correct — sizes and solved flags are cleared so the player has to
 * run them, which also stops a hand-edited bundle from unlocking the campaign.
 */
export function importSolutions(current: Progress, text: string): ImportOutcome {
  let bundle: ExportBundle;
  try {
    bundle = JSON.parse(text) as ExportBundle;
  } catch {
    return { ok: false, message: 'That is not valid JSON.' };
  }
  if (bundle?.format !== 'cn-slicer/solutions') {
    return { ok: false, message: 'Not a CodeNSliceR solution bundle.' };
  }
  const next: Progress = { ...current, levels: { ...current.levels } };
  let count = 0;
  for (const [id, entry] of Object.entries(bundle.solutions ?? {})) {
    if (!LEVELS.some((l) => l.id === id)) continue;
    if (typeof entry?.source !== 'string') continue;
    const existing = levelProgress(current, id);
    next.levels[id] = { ...existing, source: entry.source };
    count++;
  }
  if (count === 0) return { ok: false, message: 'The bundle contained no usable solutions.' };
  return {
    ok: true,
    message: `Loaded ${count} solution${count === 1 ? '' : 's'}. Run each one to re-verify it.`,
    progress: next,
  };
}
