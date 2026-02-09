// ============================================================
// useSelectionContext — Track what element type is selected
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import type { ToolbarContext, FormattingState } from '../core/types';
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

// ----------------------------------------------------------
// Default formatting state
// ----------------------------------------------------------

const DEFAULT_FORMATTING_STATE: FormattingState = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  justifyLeft: false,
  justifyCenter: false,
  justifyRight: false,
  justifyFull: false,
  orderedList: false,
  unorderedList: false,
  superscript: false,
  subscript: false,
  fontName: '',
  fontSize: '3',
  foreColor: '#000000',
  backColor: '',
  formatBlock: 'p',
};

/**
 * Hook to query the current formatting state (bold, italic, font, etc.)
 * from the browser's selection. Updates reactively on every
 * `selectionchange` event.
 *
 * Returns the full `FormattingState` object — consumers can use any
 * fields they need for their own toolbar UI.
 */
export function useFormattingState(): FormattingState {
  const [state, setState] = useState<FormattingState>(DEFAULT_FORMATTING_STATE);

  const updateState = useCallback(() => {
    try {
      // Normalise the formatBlock value — browsers return inconsistently
      let formatBlock = document.queryCommandValue('formatBlock') || '';
      formatBlock = formatBlock.replace(/^<|>$/g, '').toLowerCase();
      if (!formatBlock || formatBlock === 'div') formatBlock = 'p';

      setState({
        // Toggle states
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikethrough: document.queryCommandState('strikethrough'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
        justifyFull: document.queryCommandState('justifyFull'),
        orderedList: document.queryCommandState('insertOrderedList'),
        unorderedList: document.queryCommandState('insertUnorderedList'),
        superscript: document.queryCommandState('superscript'),
        subscript: document.queryCommandState('subscript'),
        // Value states
        fontName: document.queryCommandValue('fontName') || '',
        fontSize: document.queryCommandValue('fontSize') || '3',
        foreColor: document.queryCommandValue('foreColor') || '#000000',
        backColor: document.queryCommandValue('backColor') || '',
        formatBlock,
      });
    } catch {
      // queryCommand can throw in some edge cases — ignore
    }
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', updateState);
    return () => {
      document.removeEventListener('selectionchange', updateState);
    };
  }, [updateState]);

  return state;
}
