// ============================================================
// useSelectionSaver — Save / restore browser selection
// ============================================================
// Toolbar controls (selects, color pickers, buttons) steal focus
// from contentEditable areas, clearing the browser selection.
// This hook provides helpers to save the current range before
// focus moves and restore it before executing a format command.
//
// Usage in a consumer toolbar:
//
//   const { saveSelection, restoreAndExec } = useSelectionSaver();
//
//   <select onMouseDown={saveSelection} onChange={(e) => {
//     restoreAndExec(() => canvasRef.current?.execCommand('fontSize', e.target.value));
//   }}>
// ============================================================

import { useRef, useCallback } from 'react';

export interface SelectionSaver {
  /** Call on mouseDown of a toolbar control to snapshot the current selection */
  saveSelection: () => void;
  /** Restore a previously saved selection */
  restoreSelection: () => void;
  /** Restore the selection and then run a callback (convenience) */
  restoreAndExec: (fn: () => void) => void;
}

/**
 * Hook that provides save/restore helpers for the browser selection.
 * Use `saveSelection` as the `onMouseDown` handler on toolbar controls,
 * then call `restoreAndExec(fn)` inside the control's `onChange` /
 * `onClick` to restore the selection before running the format command.
 */
export function useSelectionSaver(): SelectionSaver {
  const savedRangeRef = useRef<Range | null>(null);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const range = savedRangeRef.current;
    if (!range) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, []);

  const restoreAndExec = useCallback(
    (fn: () => void) => {
      restoreSelection();
      fn();
    },
    [restoreSelection]
  );

  return { saveSelection, restoreSelection, restoreAndExec };
}
