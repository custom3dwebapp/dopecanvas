// ============================================================
// DopeCanvas — Main canvas component
// ============================================================
// The top-level React component that composes the paged view
// and document engine together.
//
// The toolbar is NOT rendered by default. Instead, all toolbar
// actions are exposed via a ref-based API (DopeCanvasHandle).
// Consumers can build their own toolbar UI or use the provided
// Toolbar components separately.
//
// CRITICAL DESIGN: Content edits from the user update a ref,
// NOT state. This prevents React from re-rendering (and thus
// destroying) the live editable DOM. Only page config changes
// or external HTML loads trigger re-pagination.
// ============================================================

import React, { useMemo, useCallback, useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { PagedView } from './PagedView';
import type { PagedViewHandle } from './PagedView';
import { PageLayoutEngine } from '../core/PageLayoutEngine';
import { EditableManager } from '../core/EditableManager';
import type {
  PageConfig,
  PaginationResult,
} from '../core/types';
import { DEFAULT_PAGE_CONFIG } from '../core/types';

// ----------------------------------------------------------
// Public API handle exposed via ref
// ----------------------------------------------------------

export interface DopeCanvasHandle {
  // Text formatting
  /** Execute a formatting command (e.g. 'bold', 'italic', 'fontSize') */
  execCommand: (command: string, value?: string) => boolean;
  /** Check if a command is active for the current selection */
  queryCommandState: (command: string) => boolean;
  /** Get the value of a command for the current selection */
  queryCommandValue: (command: string) => string;

  // Page configuration
  /** Get the current page configuration */
  getPageConfig: () => PageConfig;
  /** Update page configuration (size, margins). Triggers re-pagination. */
  setPageConfig: (config: Partial<PageConfig>) => void;
  /** Get the current number of pages */
  getPageCount: () => number;

  // Content access
  /** Get the current document HTML (reflects user edits) */
  getHTML: () => string;
  /** Get the document content as plain text */
  getPlainText: () => string;

  // Undo / Redo
  /** Undo the last edit. Returns false if nothing to undo. */
  undo: () => boolean;
  /** Redo the last undone edit. Returns false if nothing to redo. */
  redo: () => boolean;

  // Page breaks
  /** Insert a page break after the block at the cursor (or at end) */
  insertPageBreak: () => void;
  /** Show or hide visual page break indicators */
  setShowPageBreaks: (show: boolean) => void;
  /** Get the current show-page-breaks state */
  getShowPageBreaks: () => boolean;
}

// ----------------------------------------------------------
// Component props
// ----------------------------------------------------------

export interface DopeCanvasProps {
  /** Initial HTML content to load */
  html?: string;
  /** Optional CSS to inject alongside the HTML */
  css?: string;
  /** Page configuration */
  pageConfig?: PageConfig;
  /** Callback when content changes */
  onContentChange?: (html: string) => void;
  /** Callback when page config changes */
  onPageConfigChange?: (config: PageConfig) => void;
  /** Style overrides for the root container */
  style?: React.CSSProperties;
}

export const DopeCanvas = forwardRef<DopeCanvasHandle, DopeCanvasProps>(({
  html = '',
  css,
  pageConfig: externalPageConfig,
  onContentChange,
  onPageConfigChange,
  style,
}, ref) => {
  const [internalPageConfig, setInternalPageConfig] = useState<PageConfig>(
    externalPageConfig || DEFAULT_PAGE_CONFIG
  );
  const [paginationResult, setPaginationResult] = useState<PaginationResult>({
    pages: [],
    pageCount: 0,
  });
  // Store the latest HTML in a ref — edits update this without triggering re-render
  const currentHTMLRef = useRef(html);
  // Root container ref — used to read live DOM content in getHTML()
  const rootRef = useRef<HTMLDivElement>(null);
  // PagedView ref — used for page break insertion
  const pagedViewRef = useRef<PagedViewHandle>(null);

  // Page break visibility toggle
  const [showPageBreaks, setShowPageBreaks] = useState(false);

  // Stable callback ref for onContentChange so PagedView doesn't re-render
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  // Use external config if provided, otherwise internal
  const pageConfig = externalPageConfig || internalPageConfig;

  // Create engine instances (stable across renders)
  const layoutEngine = useMemo(() => new PageLayoutEngine(pageConfig), []);
  const editableManager = useMemo(() => new EditableManager(), []);

  // Update layout engine when config changes
  useEffect(() => {
    layoutEngine.setConfig(pageConfig);
  }, [pageConfig, layoutEngine]);

  // Handle content changes from editing — update ref only, no state
  const handleContentChange = useCallback(
    (newHTML: string) => {
      currentHTMLRef.current = newHTML;
      onContentChangeRef.current?.(newHTML);
    },
    []
  );

  // Handle page config changes
  const handlePageConfigChange = useCallback(
    (newConfig: Partial<PageConfig>) => {
      const updated = {
        ...pageConfig,
        ...newConfig,
        margins: {
          ...pageConfig.margins,
          ...(newConfig.margins || {}),
        },
      };
      setInternalPageConfig(updated);
      layoutEngine.setConfig(updated);
      onPageConfigChange?.(updated);
    },
    [pageConfig, layoutEngine, onPageConfigChange]
  );

  // Handle pagination updates
  const handlePaginationChange = useCallback((result: PaginationResult) => {
    setPaginationResult(result);
  }, []);

  // ----------------------------------------------------------
  // Expose API via ref
  // ----------------------------------------------------------

  useImperativeHandle(ref, () => ({
    execCommand: (command: string, value?: string) => {
      return editableManager.execCommand(command, value);
    },
    queryCommandState: (command: string) => {
      return editableManager.queryCommandState(command);
    },
    queryCommandValue: (command: string) => {
      return editableManager.queryCommandValue(command);
    },
    getPageConfig: () => ({ ...pageConfig }),
    setPageConfig: (config: Partial<PageConfig>) => {
      handlePageConfigChange(config);
    },
    getPageCount: () => paginationResult.pageCount,
    getHTML: () => {
      // Read directly from the live DOM so edits are never missed
      // (the MutationObserver in PagedView debounces updates to the ref,
      //  so the ref can be stale if getHTML is called right after an edit)
      if (rootRef.current) {
        const contentDivs = rootRef.current.querySelectorAll(
          '.dopecanvas-block-content'
        );
        if (contentDivs.length > 0) {
          const parts: string[] = [];
          contentDivs.forEach((div) => {
            const child = div.firstElementChild as HTMLElement;
            if (child) parts.push(child.outerHTML);
          });
          if (parts.length > 0) {
            const freshHTML = parts.join('\n');
            currentHTMLRef.current = freshHTML; // keep ref in sync
            return freshHTML;
          }
        }
      }
      return currentHTMLRef.current;
    },
    getPlainText: () => {
      // Also read from live DOM for consistency
      const liveHTML = rootRef.current
        ? (() => {
            const divs = rootRef.current!.querySelectorAll('.dopecanvas-block-content');
            const parts: string[] = [];
            divs.forEach((d) => {
              const child = d.firstElementChild as HTMLElement;
              if (child) parts.push(child.outerHTML);
            });
            return parts.length > 0 ? parts.join('\n') : currentHTMLRef.current;
          })()
        : currentHTMLRef.current;
      const tmp = document.createElement('div');
      tmp.innerHTML = liveHTML;
      return tmp.innerText || tmp.textContent || '';
    },
    undo: () => editableManager.undo(),
    redo: () => editableManager.redo(),
    insertPageBreak: () => {
      pagedViewRef.current?.insertPageBreak();
    },
    setShowPageBreaks: (show: boolean) => {
      setShowPageBreaks(show);
    },
    getShowPageBreaks: () => showPageBreaks,
  }), [editableManager, pageConfig, paginationResult.pageCount, handlePageConfigChange, showPageBreaks]);

  return (
    <div
      ref={rootRef}
      className="dopecanvas-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        ...style,
      }}
    >
      {/* Paged document view */}
      <PagedView
        ref={pagedViewRef}
        html={html}
        css={css}
        pageConfig={pageConfig}
        layoutEngine={layoutEngine}
        editableManager={editableManager}
        onContentChange={handleContentChange}
        onPaginationChange={handlePaginationChange}
        showPageBreaks={showPageBreaks}
      />
    </div>
  );
});
