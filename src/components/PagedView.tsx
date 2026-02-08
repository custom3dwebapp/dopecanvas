// ============================================================
// PagedView — Renders paginated blocks across page frames
// ============================================================
// Takes HTML content, paginates it into visual pages, and makes
// each block editable via contentEditable.
//
// After initial pagination, the live DOM is the source of truth.
// User edits trigger live re-pagination when the block distribution
// across pages changes (e.g. content grows past a page boundary).
// Cursor position is saved/restored across re-pagination re-renders.
// ============================================================

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Page } from './Page';
import { BlockToolbar } from './BlockToolbar';
import { HTMLEditorModal } from './HTMLEditorModal';
import type { PageLayoutEngine } from '../core/PageLayoutEngine';
import type { EditableManager } from '../core/EditableManager';
import type {
  PageConfig,
  PaginationResult,
  PageSizeName,
} from '../core/types';
import { PAGE_SIZE_PRESETS } from '../core/types';

interface PagedViewProps {
  /** The raw HTML content to render */
  html: string;
  /** Optional CSS to inject */
  css?: string;
  /** Page configuration */
  pageConfig: PageConfig;
  /** The layout engine instance */
  layoutEngine: PageLayoutEngine;
  /** The editable manager instance */
  editableManager: EditableManager;
  /** Callback when content changes (after user edit) — updates a ref, NOT state */
  onContentChange?: (html: string) => void;
  /** Callback when pagination changes */
  onPaginationChange?: (result: PaginationResult) => void;
}

/**
 * Represents a block of content assigned to a specific page.
 * We store the HTML string so React can render it once, then
 * the live DOM takes over for editing.
 */
interface PageData {
  blocks: string[]; // outerHTML of each block in this page
}

/**
 * Execute <script> tags found in a container.
 * Scripts set via innerHTML / dangerouslySetInnerHTML do NOT auto-execute.
 * We clone each one into a fresh <script> element so the browser runs it.
 */
function activateScripts(container: HTMLElement): HTMLScriptElement[] {
  const activated: HTMLScriptElement[] = [];

  container.querySelectorAll('script').forEach((orig) => {
    const fresh = document.createElement('script');
    // Preserve attributes (type, src, data-*, etc.)
    Array.from(orig.attributes).forEach((attr) =>
      fresh.setAttribute(attr.name, attr.value)
    );
    fresh.textContent = orig.textContent || '';
    // Replacing the node triggers synchronous execution for inline scripts
    orig.parentNode?.replaceChild(fresh, orig);
    activated.push(fresh);
  });

  return activated;
}

// ----------------------------------------------------------
// Cursor save / restore — used across re-pagination re-renders
// ----------------------------------------------------------

interface CursorState {
  /** Global index of the block wrapper the cursor is inside */
  blockIndex: number;
  /** Character offset within that block's text content */
  textOffset: number;
}

/** Save the current cursor position relative to block content divs */
function saveCursorPosition(container: HTMLElement): CursorState | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  const anchorNode = range.startContainer;

  const wrappers = Array.from(
    container.querySelectorAll('.dopecanvas-block-content')
  );
  const blockIndex = wrappers.findIndex((w) => w.contains(anchorNode));
  if (blockIndex === -1) return null;

  // Compute character offset within the block
  try {
    const preRange = document.createRange();
    preRange.selectNodeContents(wrappers[blockIndex]);
    preRange.setEnd(range.startContainer, range.startOffset);
    const textOffset = preRange.toString().length;
    return { blockIndex, textOffset };
  } catch {
    return null;
  }
}

/** Restore cursor position after a re-pagination re-render */
function restoreCursorPosition(
  container: HTMLElement,
  state: CursorState
): void {
  const wrappers = container.querySelectorAll('.dopecanvas-block-content');
  if (state.blockIndex >= wrappers.length) return;

  const wrapper = wrappers[state.blockIndex];
  const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
  let remaining = state.textOffset;

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    if (remaining <= textNode.length) {
      try {
        const range = document.createRange();
        range.setStart(textNode, remaining);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch {
        // Best effort — position may have shifted
      }
      return;
    }
    remaining -= textNode.length;
  }

  // Fallback: place cursor at the end of the block
  try {
    const range = document.createRange();
    range.selectNodeContents(wrapper);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  } catch {
    // Ignore
  }
}

/**
 * Memoized block content — prevents React from re-rendering (and
 * resetting innerHTML) when unrelated state like hoveredBlockIndex
 * changes. User edits via contentEditable are preserved.
 */
const MemoizedBlockContent = React.memo<{
  html: string;
  isEditable: boolean;
  isTable: boolean;
}>(({ html, isEditable, isTable }) => (
  <div
    className="dopecanvas-block-content"
    contentEditable={isEditable && !isTable ? true : undefined}
    suppressContentEditableWarning
    dangerouslySetInnerHTML={{ __html: html }}
  />
));

export const PagedView: React.FC<PagedViewProps> = ({
  html,
  css,
  pageConfig,
  layoutEngine,
  editableManager: _editableManager,
  onContentChange,
  onPaginationChange,
}) => {
  const measureRef = useRef<HTMLDivElement>(null);
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  // Pages state — set during pagination AND live re-pagination
  const [pages, setPages] = useState<PageData[]>([]);

  // Refs for live re-pagination
  const pendingCursorRef = useRef<CursorState | null>(null);
  const isRePaginatingRef = useRef(false);
  const pagesRef = useRef<PageData[]>([]);

  // Block management state
  const [hoveredBlockIndex, setHoveredBlockIndex] = useState<number | null>(null);
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [editingHTML, setEditingHTML] = useState<string>('');
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve page dimensions
  const dimensions =
    typeof pageConfig.size === 'string'
      ? PAGE_SIZE_PRESETS[pageConfig.size as PageSizeName]
      : pageConfig.size;

  // ----------------------------------------------------------
  // Collect current HTML from the live DOM (no re-render)
  // ----------------------------------------------------------

  const collectHTMLFromDOM = useCallback(() => {
    if (!pagesContainerRef.current) return;

    const contentDivs = pagesContainerRef.current.querySelectorAll(
      '.dopecanvas-block-content'
    );

    const htmlParts: string[] = [];
    contentDivs.forEach((contentDiv) => {
      const content = contentDiv.firstElementChild as HTMLElement;
      if (content) {
        htmlParts.push(content.outerHTML);
      }
    });

    const updatedHTML = htmlParts.join('\n');
    onContentChangeRef.current?.(updatedHTML);
  }, []);

  // ----------------------------------------------------------
  // Shared pagination: measure + paginate any HTML string
  // ----------------------------------------------------------

  const paginateHTML = useCallback((htmlContent: string) => {
    if (!measureRef.current) return;

    const mc = measureRef.current;
    mc.style.width = `${layoutEngine.getContentAreaWidth()}px`;
    mc.style.position = 'absolute';
    mc.style.left = '-9999px';
    mc.style.top = '0';
    mc.style.visibility = 'hidden';
    mc.innerHTML = '';

    if (css) {
      const styleEl = document.createElement('style');
      styleEl.textContent = css;
      mc.appendChild(styleEl);
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = htmlContent;
    mc.appendChild(wrapper);

    const measurements = layoutEngine.measureBlocks(wrapper);
    const blockHTMLs = measurements.map(
      (m) => (m.element.cloneNode(true) as HTMLElement).outerHTML
    );
    const result = layoutEngine.paginate(measurements);

    const pageData: PageData[] = result.pages.map((page) => ({
      blocks: page.blockIndices.map((idx) => blockHTMLs[idx]),
    }));

    mc.innerHTML = '';

    pagesRef.current = pageData;
    setPages(pageData);
    onPaginationChange?.(result);
    onContentChangeRef.current?.(htmlContent);
  }, [css, layoutEngine, onPaginationChange]);

  // ----------------------------------------------------------
  // Live re-pagination — runs after user edits change block sizes
  // ----------------------------------------------------------

  const rePaginateFromDOM = useCallback(() => {
    if (!pagesContainerRef.current || !measureRef.current) return;

    const container = pagesContainerRef.current;

    // Save cursor position before we potentially re-render
    const cursor = saveCursorPosition(container);

    // Collect block HTML from the live DOM
    const contentDivs = container.querySelectorAll('.dopecanvas-block-content');
    const blockHTMLs: string[] = [];
    contentDivs.forEach((div) => {
      const content = div.firstElementChild as HTMLElement;
      if (content) blockHTMLs.push(content.outerHTML);
    });
    if (blockHTMLs.length === 0) return;

    // Set up hidden measure container
    const mc = measureRef.current;
    const contentWidth = layoutEngine.getContentAreaWidth();
    mc.style.width = `${contentWidth}px`;
    mc.style.position = 'absolute';
    mc.style.left = '-9999px';
    mc.style.top = '0';
    mc.style.visibility = 'hidden';
    mc.innerHTML = '';

    if (css) {
      const styleEl = document.createElement('style');
      styleEl.textContent = css;
      mc.appendChild(styleEl);
    }

    const measureWrapper = document.createElement('div');
    measureWrapper.innerHTML = blockHTMLs.join('\n');
    mc.appendChild(measureWrapper);

    // Measure and paginate
    const measurements = layoutEngine.measureBlocks(measureWrapper);
    const measuredHTMLs = measurements.map(
      (m) => (m.element.cloneNode(true) as HTMLElement).outerHTML
    );
    const result = layoutEngine.paginate(measurements);
    mc.innerHTML = '';

    // Build new page data
    const newPages: PageData[] = result.pages.map((p) => ({
      blocks: p.blockIndices.map((idx) => measuredHTMLs[idx]),
    }));

    // Only re-render if the block distribution across pages actually changed
    const oldDist = pagesRef.current.map((p) => p.blocks.length);
    const newDist = newPages.map((p) => p.blocks.length);
    const changed =
      oldDist.length !== newDist.length ||
      oldDist.some((count, i) => count !== newDist[i]);

    if (changed) {
      isRePaginatingRef.current = true;
      pendingCursorRef.current = cursor;
      pagesRef.current = newPages;
      setPages(newPages);
      onPaginationChange?.(result);
    }
  }, [css, layoutEngine, onPaginationChange]);

  // Keep a stable ref so the MutationObserver closure always calls the latest version
  const rePaginateFromDOMRef = useRef(rePaginateFromDOM);
  rePaginateFromDOMRef.current = rePaginateFromDOM;

  // ----------------------------------------------------------
  // Pagination — runs on initial load and config changes
  // ----------------------------------------------------------

  const runPagination = useCallback(() => {
    // Parse the LLM-authored HTML.
    // An LLM may produce a full document (<!DOCTYPE html><html><head>
    // <style>…</style></head><body>…</body></html>) or a plain fragment.
    // DOMParser handles both: for fragments it wraps in html/body;
    // for full documents it parses normally. We then move any <head>
    // styles/links into the body so they participate in pagination
    // as zero-height blocks and their styles apply to the content.
    const parsed = new DOMParser().parseFromString(html, 'text/html');

    // Rescue <style> and <link rel="stylesheet"> from <head>
    parsed.head
      .querySelectorAll('style, link[rel="stylesheet"]')
      .forEach((el) => {
        parsed.body.insertBefore(el, parsed.body.firstChild);
      });

    paginateHTML(parsed.body.innerHTML);
  }, [html, paginateHTML]);

  // Run pagination when html or pageConfig changes
  useEffect(() => {
    runPagination();
  }, [runPagination]);

  // ----------------------------------------------------------
  // Block management — add / delete / edit HTML
  // ----------------------------------------------------------

  /** Collect all block outerHTMLs from the live DOM */
  const collectBlocksFromDOM = useCallback((): string[] => {
    if (!pagesContainerRef.current) return [];
    const contentDivs = pagesContainerRef.current.querySelectorAll(
      '.dopecanvas-block-content'
    );
    const blocks: string[] = [];
    contentDivs.forEach((div) => {
      const child = div.firstElementChild as HTMLElement;
      if (child) blocks.push(child.outerHTML);
    });
    return blocks;
  }, []);

  /** Add a new empty block below the given global index */
  const handleAddBlock = useCallback(
    (globalIndex: number) => {
      const blocks = collectBlocksFromDOM();
      blocks.splice(
        globalIndex + 1,
        0,
        '<p style="min-height: 1.5em; line-height: 1.6;">&nbsp;</p>'
      );
      setHoveredBlockIndex(null);
      paginateHTML(blocks.join('\n'));
    },
    [collectBlocksFromDOM, paginateHTML]
  );

  /** Delete the block at the given global index */
  const handleDeleteBlock = useCallback(
    (globalIndex: number) => {
      const blocks = collectBlocksFromDOM();
      if (blocks.length <= 1) return; // keep at least one block
      blocks.splice(globalIndex, 1);
      setHoveredBlockIndex(null);
      paginateHTML(blocks.join('\n'));
    },
    [collectBlocksFromDOM, paginateHTML]
  );

  /** Open the HTML source editor for the given block */
  const handleOpenEditor = useCallback(
    (globalIndex: number) => {
      const blocks = collectBlocksFromDOM();
      if (globalIndex < blocks.length) {
        setEditingBlockIndex(globalIndex);
        setEditingHTML(blocks[globalIndex]);
      }
    },
    [collectBlocksFromDOM]
  );

  /** Save edited HTML and re-paginate */
  const handleSaveHTML = useCallback(
    (newHTML: string) => {
      if (editingBlockIndex === null) return;
      const blocks = collectBlocksFromDOM();
      if (editingBlockIndex < blocks.length) {
        blocks[editingBlockIndex] = newHTML;
      }
      setEditingBlockIndex(null);
      setEditingHTML('');
      setHoveredBlockIndex(null);
      paginateHTML(blocks.join('\n'));
    },
    [editingBlockIndex, collectBlocksFromDOM, paginateHTML]
  );

  /** Cancel the HTML editor */
  const handleCancelEditor = useCallback(() => {
    setEditingBlockIndex(null);
    setEditingHTML('');
  }, []);

  // ----------------------------------------------------------
  // After pages render: make editable + observe changes
  // ----------------------------------------------------------

  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;

    // Disconnect previous observer
    if (mutationObserverRef.current) {
      mutationObserverRef.current.disconnect();
    }

    // Make table cells individually editable.
    // Non-table blocks get contentEditable from their React prop;
    // tables need cell-level editability so users can't break table structure.
    const blockContents = container.querySelectorAll('.dopecanvas-block-content');
    blockContents.forEach((contentDiv) => {
      const child = contentDiv.firstElementChild as HTMLElement;
      if (!child) return;

      if (child.tagName === 'TABLE') {
        const cells = child.querySelectorAll('td, th');
        cells.forEach((cell) => {
          (cell as HTMLElement).contentEditable = 'true';
        });
      }
    });

    // Execute <script> tags embedded in the LLM-authored HTML.
    // This must run AFTER contentEditable setup so scripts can override
    // editability on specific cells (e.g. formula cells).
    const activatedScripts = activateScripts(container);

    // Set up MutationObserver — collects HTML and re-paginates when needed
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new MutationObserver(() => {
      if (isRePaginatingRef.current) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        collectHTMLFromDOM();
        rePaginateFromDOMRef.current();
      }, 300);
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: false,
    });

    mutationObserverRef.current = observer;

    // Restore cursor after a re-pagination re-render
    if (pendingCursorRef.current) {
      requestAnimationFrame(() => {
        if (pendingCursorRef.current && pagesContainerRef.current) {
          restoreCursorPosition(
            pagesContainerRef.current,
            pendingCursorRef.current
          );
          pendingCursorRef.current = null;
        }
        isRePaginatingRef.current = false;
      });
    } else {
      isRePaginatingRef.current = false;
    }

    return () => {
      observer.disconnect();
      activatedScripts.forEach((s) => s.remove());
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [pages, collectHTMLFromDOM]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="dopecanvas-paged-view" style={scrollContainerStyle}>
      {/* Hidden measurement container */}
      <div ref={measureRef} aria-hidden="true" />

      {/* Visible pages */}
      <div ref={pagesContainerRef} style={pagesWrapperStyle}>
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        {pages.map((pageData, pageIndex) => {
          // Compute this page's starting global block index
          const pageStartIdx = pages
            .slice(0, pageIndex)
            .reduce((sum, p) => sum + p.blocks.length, 0);

          return (
            <Page
              key={pageIndex}
              dimensions={dimensions}
              margins={pageConfig.margins}
              pageNumber={pageIndex + 1}
              totalPages={pages.length}
            >
              {pageData.blocks.map((blockHTML, blockIndex) => {
                const globalIdx = pageStartIdx + blockIndex;
                const lower = blockHTML.trim().toLowerCase();
                const isEditable =
                  !lower.startsWith('<script') && !lower.startsWith('<style');

                const isTable = lower.startsWith('<table');

                return (
                  <div
                    key={`${pageIndex}-${blockIndex}`}
                    className="dopecanvas-block-wrapper"
                    style={{ position: 'relative' }}
                    onMouseEnter={() => {
                      if (!isEditable) return;
                      if (hideTimeoutRef.current) {
                        clearTimeout(hideTimeoutRef.current);
                        hideTimeoutRef.current = null;
                      }
                      setHoveredBlockIndex(globalIdx);
                    }}
                    onMouseLeave={() => {
                      hideTimeoutRef.current = setTimeout(() => {
                        setHoveredBlockIndex((prev) =>
                          prev === globalIdx ? null : prev
                        );
                      }, 250);
                    }}
                  >
                    <MemoizedBlockContent
                      html={blockHTML}
                      isEditable={isEditable}
                      isTable={isTable}
                    />
                    {isEditable && (
                      <BlockToolbar
                        visible={hoveredBlockIndex === globalIdx}
                        onAddBelow={() => handleAddBlock(globalIdx)}
                        onEditHTML={() => handleOpenEditor(globalIdx)}
                        onDelete={() => handleDeleteBlock(globalIdx)}
                      />
                    )}
                  </div>
                );
              })}
            </Page>
          );
        })}

        {/* Show at least one empty page if no content */}
        {pages.length === 0 && (
          <Page
            dimensions={dimensions}
            margins={pageConfig.margins}
            pageNumber={1}
            totalPages={1}
          >
            <div
              contentEditable="true"
              style={{ minHeight: '1em', outline: 'none' }}
              data-placeholder="Start typing..."
            />
          </Page>
        )}
      </div>

      {/* HTML Editor Modal */}
      {editingBlockIndex !== null && (
        <HTMLEditorModal
          html={editingHTML}
          onSave={handleSaveHTML}
          onCancel={handleCancelEditor}
        />
      )}
    </div>
  );
};

// ----------------------------------------------------------
// Styles
// ----------------------------------------------------------

const scrollContainerStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  backgroundColor: '#e8e8e8',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const pagesWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '24px',
  padding: '24px 0',
};
