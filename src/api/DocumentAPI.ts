// ============================================================
// DocumentAPI — External programmatic interface
// ============================================================
// This class provides a clean API for external systems
// (LLMs, database sync, parent applications) to interact
// with a DopeCanvas document.
// ============================================================

import type { PageConfig, PaginationResult, Unsubscribe } from '../core/types';

/**
 * DocumentAPI provides a programmatic interface to the DopeCanvas
 * document. It wraps the internal state management and exposes
 * methods for loading, reading, and modifying document content.
 *
 * Usage:
 *   const api = new DocumentAPI();
 *   // Connect to a DopeCanvas instance (done internally by DopeCanvas component)
 *   api.loadHTML('<h1>Hello</h1><p>World</p>');
 *   api.onChange((html) => console.log('Content changed:', html));
 */
export class DocumentAPI {
  private _html: string = '';
  private _css: string = '';
  private _pageConfig: PageConfig | null = null;
  private _paginationResult: PaginationResult = { pages: [], pageCount: 0 };

  // Callbacks
  private _changeCallbacks: Set<(html: string) => void> = new Set();
  private _loadCallbacks: Set<(html: string, css?: string) => void> = new Set();
  private _pageConfigCallbacks: Set<(config: PageConfig) => void> = new Set();

  // Connector functions set by DopeCanvas component
  private _getHTMLFn: (() => string) | null = null;
  private _getPlainTextFn: (() => string) | null = null;

  // ----------------------------------------------------------
  // Content loading
  // ----------------------------------------------------------

  /**
   * Load HTML content into the canvas.
   * Optionally provide CSS to inject alongside.
   */
  loadHTML(html: string, css?: string): void {
    this._html = html;
    this._css = css || '';
    this._loadCallbacks.forEach((cb) => cb(html, css));
  }

  /**
   * Get the current document HTML content.
   * Reflects any user edits.
   */
  getHTML(): string {
    if (this._getHTMLFn) {
      return this._getHTMLFn();
    }
    return this._html;
  }

  /**
   * Get the document content as plain text.
   */
  getPlainText(): string {
    if (this._getPlainTextFn) {
      return this._getPlainTextFn();
    }
    // Fallback: strip HTML tags
    const tmp = document.createElement('div');
    tmp.innerHTML = this._html;
    return tmp.innerText || tmp.textContent || '';
  }

  // ----------------------------------------------------------
  // Event listeners
  // ----------------------------------------------------------

  /**
   * Listen for content changes (triggered by user edits).
   * Returns an unsubscribe function.
   */
  onChange(callback: (html: string) => void): Unsubscribe {
    this._changeCallbacks.add(callback);
    return () => {
      this._changeCallbacks.delete(callback);
    };
  }

  /**
   * Listen for load events (when loadHTML is called).
   */
  onLoad(callback: (html: string, css?: string) => void): Unsubscribe {
    this._loadCallbacks.add(callback);
    return () => {
      this._loadCallbacks.delete(callback);
    };
  }

  /**
   * Listen for page config changes.
   */
  onPageConfigChange(callback: (config: PageConfig) => void): Unsubscribe {
    this._pageConfigCallbacks.add(callback);
    return () => {
      this._pageConfigCallbacks.delete(callback);
    };
  }

  // ----------------------------------------------------------
  // Page operations
  // ----------------------------------------------------------

  /**
   * Get the current number of pages.
   */
  getPageCount(): number {
    return this._paginationResult.pageCount;
  }

  /**
   * Get the current page configuration.
   */
  getPageConfig(): PageConfig | null {
    return this._pageConfig;
  }

  /**
   * Set page configuration (size, margins).
   * Triggers re-pagination.
   */
  setPageConfig(config: Partial<PageConfig>): void {
    if (this._pageConfig) {
      this._pageConfig = {
        ...this._pageConfig,
        ...config,
        margins: {
          ...this._pageConfig.margins,
          ...(config.margins || {}),
        },
      };
      this._pageConfigCallbacks.forEach((cb) => cb(this._pageConfig!));
    }
  }

  // ----------------------------------------------------------
  // Element access (for future DB sync)
  // ----------------------------------------------------------

  /**
   * Query elements within the document by CSS selector.
   * Useful for targeting specific sections for database sync.
   */
  querySelectorAll(selector: string): Element[] {
    const tmp = document.createElement('div');
    tmp.innerHTML = this.getHTML();
    return Array.from(tmp.querySelectorAll(selector));
  }

  /**
   * Get the innerHTML of a specific element by its ID.
   */
  getElementContent(id: string): string | null {
    const tmp = document.createElement('div');
    tmp.innerHTML = this.getHTML();
    const el = tmp.querySelector(`#${id}`);
    return el ? el.innerHTML : null;
  }

  /**
   * Set the innerHTML of a specific element by its ID.
   * Re-loads the full document with the modification.
   */
  setElementContent(id: string, html: string): void {
    const tmp = document.createElement('div');
    tmp.innerHTML = this.getHTML();
    const el = tmp.querySelector(`#${id}`);
    if (el) {
      el.innerHTML = html;
      this.loadHTML(tmp.innerHTML, this._css);
    }
  }

  // ----------------------------------------------------------
  // Internal connectors (used by DopeCanvas component)
  // ----------------------------------------------------------

  /** @internal Called by DopeCanvas to wire up live content access */
  _connectGetHTML(fn: () => string): void {
    this._getHTMLFn = fn;
  }

  /** @internal Called by DopeCanvas to wire up plain text access */
  _connectGetPlainText(fn: () => string): void {
    this._getPlainTextFn = fn;
  }

  /** @internal Called by DopeCanvas when content changes */
  _notifyChange(html: string): void {
    this._html = html;
    this._changeCallbacks.forEach((cb) => cb(html));
  }

  /** @internal Called by DopeCanvas when pagination runs */
  _updatePagination(result: PaginationResult): void {
    this._paginationResult = result;
  }

  /** @internal Called by DopeCanvas when page config changes */
  _updatePageConfig(config: PageConfig): void {
    this._pageConfig = config;
  }
}
