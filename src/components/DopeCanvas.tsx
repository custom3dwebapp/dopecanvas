// ============================================================
// DopeCanvas — Main canvas component
// ============================================================
// The top-level React component that composes the toolbar,
// paged view, and document engine together.
//
// CRITICAL DESIGN: Content edits from the user update a ref,
// NOT state. This prevents React from re-rendering (and thus
// destroying) the live editable DOM. Only page config changes
// or external HTML loads trigger re-pagination.
// ============================================================

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { PagedView } from './PagedView';
import { Toolbar } from './Toolbar/Toolbar';
import { PageLayoutEngine } from '../core/PageLayoutEngine';
import { EditableManager } from '../core/EditableManager';
import type {
  PageConfig,
  PaginationResult,
} from '../core/types';
import { DEFAULT_PAGE_CONFIG } from '../core/types';

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

export const DopeCanvas: React.FC<DopeCanvasProps> = ({
  html = '',
  css,
  pageConfig: externalPageConfig,
  onContentChange,
  onPageConfigChange,
  style,
}) => {
  const [internalPageConfig, setInternalPageConfig] = useState<PageConfig>(
    externalPageConfig || DEFAULT_PAGE_CONFIG
  );
  const [paginationResult, setPaginationResult] = useState<PaginationResult>({
    pages: [],
    pageCount: 0,
  });
  // Store the latest HTML in a ref — edits update this without triggering re-render
  const currentHTMLRef = useRef(html);

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

  // Handle page config changes from toolbar
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

  // Formatting commands
  const execCommand = useCallback(
    (command: string, value?: string) => {
      editableManager.execCommand(command, value);
    },
    [editableManager]
  );

  return (
    <div
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
      {/* Toolbar */}
      <Toolbar
        pageConfig={pageConfig}
        pageCount={paginationResult.pageCount}
        onExecCommand={execCommand}
        onPageConfigChange={handlePageConfigChange}
      />

      {/* Paged document view */}
      <PagedView
        html={html}
        css={css}
        pageConfig={pageConfig}
        layoutEngine={layoutEngine}
        editableManager={editableManager}
        onContentChange={handleContentChange}
        onPaginationChange={handlePaginationChange}
      />
    </div>
  );
};
