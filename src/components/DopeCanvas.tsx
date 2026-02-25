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

import React, {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { createPortal } from 'react-dom';
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
  /** Rendering mode: paginated pages or continuous flow */
  renderMode?: 'page' | 'paged' | 'flow';
  /** Rendering isolation strategy */
  isolation?: 'none' | 'scoped-css' | 'shadow' | 'iframe';
  /** Page configuration */
  pageConfig?: PageConfig;
  /** Callback when content changes */
  onContentChange?: (html: string) => void;
  /** Callback when page config changes */
  onPageConfigChange?: (config: PageConfig) => void;
  /** Style overrides for the root container */
  style?: React.CSSProperties;
}

const SHADOW_BASE_CSS = `
:host {
  display: block;
  width: 100%;
  height: 100%;
}

.dopecanvas-root {
  color: #333;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.dopecanvas-root *,
.dopecanvas-root *::before,
.dopecanvas-root *::after {
  box-sizing: border-box;
}

.dopecanvas-page {
  transition: box-shadow 0.2s ease;
}

.dopecanvas-page:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18), 0 0 1px rgba(0, 0, 0, 0.12);
}

.dopecanvas-root [contenteditable="true"] {
  outline: none;
}

.dopecanvas-root [contenteditable="true"]:hover {
  outline: 1px solid rgba(66, 133, 244, 0.08);
  border-radius: 2px;
}

.dopecanvas-root [contenteditable="true"]:focus {
  outline: 1px solid rgba(66, 133, 244, 0.2);
  border-radius: 2px;
}
`;

function normalizeRenderMode(mode: DopeCanvasProps['renderMode']): 'paged' | 'flow' {
  if (mode === 'flow') return 'flow';
  return 'paged';
}

function scopeSelector(selector: string, scope: string): string {
  const trimmed = selector.trim();
  if (!trimmed) return `${scope} *`;
  if (trimmed === ':root' || trimmed === 'html' || trimmed === 'body') return scope;
  if (trimmed === '*') return `${scope} *`;
  if (trimmed.startsWith(':root') || trimmed.startsWith('html') || trimmed.startsWith('body')) {
    return trimmed.replace(/^(:root|html|body)\b/, scope);
  }
  return `${scope} ${trimmed}`;
}

function scopeCssRules(rules: CSSRuleList, scope: string): string {
  const out: string[] = [];
  const hasMediaRule = typeof CSSMediaRule !== 'undefined';
  const hasSupportsRule = typeof CSSSupportsRule !== 'undefined';

  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      const selectors = rule.selectorText
        .split(',')
        .map((sel) => scopeSelector(sel, scope))
        .join(', ');
      out.push(`${selectors} { ${rule.style.cssText} }`);
      continue;
    }

    if (hasMediaRule && rule instanceof CSSMediaRule) {
      out.push(`@media ${rule.conditionText} { ${scopeCssRules(rule.cssRules, scope)} }`);
      continue;
    }

    if (hasSupportsRule && rule instanceof CSSSupportsRule) {
      out.push(`@supports ${rule.conditionText} { ${scopeCssRules(rule.cssRules, scope)} }`);
      continue;
    }

    out.push(rule.cssText);
  }

  return out.join('\n');
}

function createScopedCss(cssText: string, scope: string): string {
  if (!cssText.trim()) return cssText;

  const styleEl = document.createElement('style');
  styleEl.textContent = cssText;
  document.head.appendChild(styleEl);

  try {
    const sheet = styleEl.sheet as CSSStyleSheet | null;
    if (!sheet) return cssText;
    return scopeCssRules(sheet.cssRules, scope);
  } catch {
    return cssText;
  } finally {
    styleEl.remove();
  }
}

export const DopeCanvas = forwardRef<DopeCanvasHandle, DopeCanvasProps>(({
  html = '',
  css,
  renderMode = 'page',
  isolation = 'shadow',
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
  // Host container ref (light DOM host; shadow root may be attached here)
  const hostRef = useRef<HTMLDivElement>(null);
  // Root container ref — used to read live DOM content in getHTML()
  const rootRef = useRef<HTMLDivElement>(null);
  // Shadow DOM mount point for isolated rendering
  const [shadowMount, setShadowMount] = useState<HTMLDivElement | null>(null);

  // Flow-mode editable root
  const flowContentRef = useRef<HTMLDivElement>(null);
  // PagedView ref — used for page break insertion
  const pagedViewRef = useRef<PagedViewHandle>(null);

  // Page break visibility toggle
  const [showPageBreaks, setShowPageBreaks] = useState(false);

  // Stable callback ref for onContentChange so PagedView doesn't re-render
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  // Use external config if provided, otherwise internal
  const pageConfig = externalPageConfig || internalPageConfig;
  const effectiveRenderMode = normalizeRenderMode(renderMode);
  const effectiveIsolation = isolation === 'iframe' ? 'shadow' : isolation;
  const useShadowIsolation = effectiveIsolation === 'shadow';
  const effectiveCss = useMemo(
    () =>
      css && (effectiveIsolation === 'scoped-css' || effectiveIsolation === 'shadow')
        ? createScopedCss(css, '.dopecanvas-root')
        : css,
    [css, effectiveIsolation]
  );

  // Create engine instances (stable across renders)
  const layoutEngine = useMemo(() => new PageLayoutEngine(pageConfig), []);
  const editableManager = useMemo(() => new EditableManager(), []);

  // Update layout engine when config changes
  useEffect(() => {
    layoutEngine.setConfig(pageConfig);
  }, [pageConfig, layoutEngine]);

  // Create / tear down shadow root when shadow isolation is active.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (!useShadowIsolation) {
      setShadowMount(null);
      return;
    }

    let shadow = host.shadowRoot;
    if (!shadow) {
      shadow = host.attachShadow({ mode: 'open' });
    }

    shadow.innerHTML = '';

    const baseStyle = document.createElement('style');
    baseStyle.textContent = SHADOW_BASE_CSS;
    shadow.appendChild(baseStyle);

    const mount = document.createElement('div');
    mount.style.height = '100%';
    mount.style.width = '100%';
    shadow.appendChild(mount);
    setShadowMount(mount);

    return () => {
      if (host.shadowRoot) {
        host.shadowRoot.innerHTML = '';
      }
      setShadowMount(null);
    };
  }, [useShadowIsolation]);

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

  // Keep flow-mode DOM in sync when external html changes (e.g. open document)
  useEffect(() => {
    if (effectiveRenderMode !== 'flow' || !flowContentRef.current) return;
    // Use the latest known edited HTML when switching into flow mode.
    // Fall back to the incoming prop when no live content exists yet.
    const sourceHTML = currentHTMLRef.current || html;
    flowContentRef.current.innerHTML = sourceHTML;
    currentHTMLRef.current = sourceHTML;
  }, [html, effectiveRenderMode]);

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
      if (effectiveRenderMode === 'flow' && flowContentRef.current) {
        const live = flowContentRef.current.innerHTML;
        if (live) {
          currentHTMLRef.current = live;
          return live;
        }
        return currentHTMLRef.current;
      }

      // Read directly from the live DOM so edits are never missed
      // (the MutationObserver in PagedView debounces updates to the ref,
      //  so the ref can be stale if getHTML is called right after an edit)
      if (rootRef.current) {
        const contentDivs = rootRef.current.querySelectorAll(
          '.dopecanvas-block-content'
        );
        if (contentDivs.length > 0) {
          const parts: string[] = [];
          contentDivs.forEach((contentDiv) => {
            const div = contentDiv as HTMLElement;
            const children = div.children;
            
            if (children.length === 0) {
              // Empty block - skip
              return;
            } else if (children.length === 1) {
              // Single child - use its outerHTML (preserves original structure)
              parts.push((children[0] as HTMLElement).outerHTML);
            } else {
              // Multiple children (user pressed Enter and created new lines)
              // Wrap them in a div to keep as one block
              const wrapper = document.createElement('div');
              wrapper.innerHTML = div.innerHTML;
              parts.push(wrapper.outerHTML);
            }
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
      if (effectiveRenderMode === 'flow' && flowContentRef.current) {
        return (
          flowContentRef.current.innerText ||
          flowContentRef.current.textContent ||
          ''
        );
      }

      // Also read from live DOM for consistency
      const liveHTML = rootRef.current
        ? (() => {
            const divs = rootRef.current!.querySelectorAll('.dopecanvas-block-content');
            const parts: string[] = [];
            divs.forEach((contentDiv) => {
              const div = contentDiv as HTMLElement;
              const children = div.children;
              
              if (children.length === 0) {
                return;
              } else if (children.length === 1) {
                parts.push((children[0] as HTMLElement).outerHTML);
              } else {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = div.innerHTML;
                parts.push(wrapper.outerHTML);
              }
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
      if (effectiveRenderMode === 'flow' && flowContentRef.current) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        if (!flowContentRef.current.contains(range.startContainer)) return;
        const pageBreak = document.createElement('div');
        pageBreak.style.breakBefore = 'page';
        range.insertNode(pageBreak);
        range.setStartAfter(pageBreak);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        const updated = flowContentRef.current.innerHTML;
        currentHTMLRef.current = updated;
        onContentChangeRef.current?.(updated);
        return;
      }
      pagedViewRef.current?.insertPageBreak();
    },
    setShowPageBreaks: (show: boolean) => {
      setShowPageBreaks(show);
    },
    getShowPageBreaks: () => showPageBreaks,
  }), [editableManager, pageConfig, paginationResult.pageCount, handlePageConfigChange, showPageBreaks, effectiveRenderMode]);

  const canvasBody = (
    <div
      ref={rootRef}
      className="dopecanvas-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        minHeight: 0,
        minWidth: 0,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        ...style,
      }}
    >
      {/* Document view */}
      {effectiveRenderMode === 'paged' ? (
        <PagedView
          ref={pagedViewRef}
          html={html}
          css={effectiveCss}
          pageConfig={pageConfig}
          layoutEngine={layoutEngine}
          editableManager={editableManager}
          onContentChange={handleContentChange}
          onPaginationChange={handlePaginationChange}
          showPageBreaks={showPageBreaks}
        />
      ) : (
        <div style={flowContainerStyle}>
          {effectiveCss && <style dangerouslySetInnerHTML={{ __html: effectiveCss }} />}
          <div
            ref={flowContentRef}
            className="dopecanvas-flow-content"
            contentEditable
            suppressContentEditableWarning
            style={flowContentStyle}
            onInput={() => {
              if (!flowContentRef.current) return;
              const updated = flowContentRef.current.innerHTML;
              currentHTMLRef.current = updated;
              onContentChangeRef.current?.(updated);
            }}
          />
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={hostRef}
      className="dopecanvas-host"
      style={{
        height: '100%',
        width: '100%',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {useShadowIsolation
        ? (shadowMount ? createPortal(canvasBody, shadowMount) : null)
        : canvasBody}
    </div>
  );
});

const flowContainerStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  backgroundColor: '#f7f7f5',
  padding: '24px',
};

const flowContentStyle: React.CSSProperties = {
  minHeight: '100%',
  outline: 'none',
  backgroundColor: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '20px 24px',
};
