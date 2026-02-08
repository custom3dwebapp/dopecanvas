// ============================================================
// useSelectionContext — Track what element type is selected
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import type { ToolbarContext } from '../core/types';
import type { EditableManager } from '../core/EditableManager';

export function useSelectionContext(
  editableManager: EditableManager | null
): ToolbarContext {
  const [context, setContext] = useState<ToolbarContext>('none');

  useEffect(() => {
    if (!editableManager) return;

    const unsub = editableManager.onContextChange((ctx) => {
      setContext(ctx);
    });

    return unsub;
  }, [editableManager]);

  return context;
}

/**
 * Hook to query the current formatting state (bold, italic, etc.)
 * from the browser's selection.
 */
export function useFormattingState() {
  const [state, setState] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
  });

  const updateState = useCallback(() => {
    setState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikethrough: document.queryCommandState('strikethrough'),
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight'),
      justifyFull: document.queryCommandState('justifyFull'),
    });
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', updateState);
    return () => {
      document.removeEventListener('selectionchange', updateState);
    };
  }, [updateState]);

  return state;
}
