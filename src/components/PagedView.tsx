// ============================================================
// PagedView — Renders paginated blocks across page frames
// ============================================================
// Takes HTML content, paginates it into visual pages, and makes
// each block editable via contentEditable.
//
// CRITICAL: After initial pagination, the live DOM is the source
// of truth. User edits update an internal ref (via onContentChange)
// but do NOT trigger React re-renders. Only external HTML prop
// changes or pageConfig changes trigger re-pagination.
// ============================================================

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Page } from './Page';
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

  // Pages state — only set during pagination (not during edits)
  const [pages, setPages] = useState<PageData[]>([]);

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

    const wrappers = pagesContainerRef.current.querySelectorAll(
      '.dopecanvas-block-wrapper'
    );

    const htmlParts: string[] = [];
    wrappers.forEach((wrapper) => {
      // The wrapper contains the actual content element
      const content = wrapper.firstElementChild as HTMLElement;
      if (content) {
        htmlParts.push(content.outerHTML);
      }
    });

    const updatedHTML = htmlParts.join('\n');
    onContentChangeRef.current?.(updatedHTML);
  }, []);

  // ----------------------------------------------------------
  // Pagination — runs only on initial load and config changes
  // ----------------------------------------------------------

  const runPagination = useCallback(() => {
    if (!measureRef.current) return;

    const measureContainer = measureRef.current;
    const contentWidth = layoutEngine.getContentAreaWidth();

    // Set up hidden measurement container
    measureContainer.style.width = `${contentWidth}px`;
    measureContainer.style.position = 'absolute';
    measureContainer.style.left = '-9999px';
    measureContainer.style.top = '0';
    measureContainer.style.visibility = 'hidden';
    measureContainer.innerHTML = '';

    // Inject CSS if provided via prop
    if (css) {
      const styleEl = document.createElement('style');
      styleEl.textContent = css;
      measureContainer.appendChild(styleEl);
    }

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

    const contentHTML = parsed.body.innerHTML;

    // Inject content into a wrapper for measurement
    const wrapper = document.createElement('div');
    wrapper.innerHTML = contentHTML;
    measureContainer.appendChild(wrapper);

    // Measure all blocks
    const measurements = layoutEngine.measureBlocks(wrapper);

    // Clone block elements and get their HTML
    const blockHTMLs = measurements.map(
      (m) => (m.element.cloneNode(true) as HTMLElement).outerHTML
    );

    // Run pagination algorithm
    const result = layoutEngine.paginate(measurements);

    // Build page data (HTML strings, not live elements)
    const pageData: PageData[] = result.pages.map((page) => ({
      blocks: page.blockIndices.map((idx) => blockHTMLs[idx]),
    }));

    // Clean up
    measureContainer.innerHTML = '';

    // Update state — this triggers a React render
    setPages(pageData);
    onPaginationChange?.(result);
  }, [html, css, layoutEngine, onPaginationChange]);

  // Run pagination when html or pageConfig changes
  useEffect(() => {
    runPagination();
  }, [runPagination]);

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

    // Make all blocks contentEditable
    const blockWrappers = container.querySelectorAll('.dopecanvas-block-wrapper');
    blockWrappers.forEach((wrapper) => {
      const child = wrapper.firstElementChild as HTMLElement;
      if (!child) return;

      if (child.tagName === 'TABLE') {
        // For tables, make individual cells editable
        const cells = child.querySelectorAll('td, th');
        cells.forEach((cell) => {
          (cell as HTMLElement).contentEditable = 'true';
        });
      } else if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') {
        // Don't make script/style blocks editable
      } else {
        child.contentEditable = 'true';
      }
    });

    // Execute <script> tags embedded in the LLM-authored HTML.
    // This must run AFTER contentEditable setup so scripts can override
    // editability on specific cells (e.g. formula cells).
    const activatedScripts = activateScripts(container);

    // Set up MutationObserver — collects HTML on changes but does NOT re-render
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        collectHTMLFromDOM();
      }, 200);
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: false,
    });

    mutationObserverRef.current = observer;

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
        {pages.map((pageData, pageIndex) => (
          <Page
            key={pageIndex}
            dimensions={dimensions}
            margins={pageConfig.margins}
            pageNumber={pageIndex + 1}
            totalPages={pages.length}
          >
            {pageData.blocks.map((blockHTML, blockIndex) => (
              <div
                key={`${pageIndex}-${blockIndex}`}
                className="dopecanvas-block-wrapper"
                dangerouslySetInnerHTML={{ __html: blockHTML }}
              />
            ))}
          </Page>
        ))}

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
