// ============================================================
// DocumentEngine — Core orchestrator
// ============================================================
// Ties PageLayoutEngine and EditableManager together.
// Manages the lifecycle: load → parse → paginate → edit → re-paginate
// ============================================================

import { PageLayoutEngine } from './PageLayoutEngine';
import { EditableManager } from './EditableManager';
import type {
  PageConfig,
  PaginationResult,
  BlockMeasurement,
  Unsubscribe,
} from './types';
import { DEFAULT_PAGE_CONFIG } from './types';

export class DocumentEngine {
  private layoutEngine: PageLayoutEngine;
  private editableManager: EditableManager;
  private sourceHTML: string = '';
  private sourceCSS: string = '';
  private measureContainer: HTMLElement | null = null;
  private contentContainer: HTMLElement | null = null;
  private paginationResult: PaginationResult = { pages: [], pageCount: 0 };
  private paginationCallbacks: Set<(result: PaginationResult) => void> = new Set();
  private changeCallbacks: Set<(html: string) => void> = new Set();

  constructor(config: PageConfig = DEFAULT_PAGE_CONFIG) {
    this.layoutEngine = new PageLayoutEngine(config);
    this.editableManager = new EditableManager();
  }

  // ----------------------------------------------------------
  // Accessors
  // ----------------------------------------------------------

  getLayoutEngine(): PageLayoutEngine {
    return this.layoutEngine;
  }

  getEditableManager(): EditableManager {
    return this.editableManager;
  }

  getPaginationResult(): PaginationResult {
    return this.paginationResult;
  }

  getSourceHTML(): string {
    return this.sourceHTML;
  }

  getPageConfig(): PageConfig {
    return this.layoutEngine.getConfig();
  }

  // ----------------------------------------------------------
  // Load HTML content
  // ----------------------------------------------------------

  /**
   * Load LLM-generated HTML (and optional CSS) into the engine.
   * This parses the HTML and prepares it for pagination.
   */
  loadHTML(html: string, css?: string): void {
    this.sourceHTML = html;
    this.sourceCSS = css || '';
  }

  // ----------------------------------------------------------
  // Attach to DOM containers
  // ----------------------------------------------------------

  /**
   * Set the measurement container — a hidden container styled
   * to match the content area width. Used for measuring block heights.
   */
  setMeasureContainer(el: HTMLElement): void {
    this.measureContainer = el;
  }

  /**
   * Set the content container — the visible container where
   * editable blocks live. The EditableManager attaches here.
   */
  setContentContainer(el: HTMLElement): void {
    if (this.contentContainer) {
      this.editableManager.detach();
    }
    this.contentContainer = el;
  }

  // ----------------------------------------------------------
  // Pagination cycle
  // ----------------------------------------------------------

  /**
   * Run the full pagination cycle:
   * 1. Inject HTML into measure container
   * 2. Inject CSS (via <style> tag)
   * 3. Measure all blocks
   * 4. Run pagination algorithm
   * 5. Return result for rendering
   */
  runPagination(): { result: PaginationResult; measurements: BlockMeasurement[] } {
    if (!this.measureContainer) {
      return {
        result: { pages: [{ blockIndices: [] }], pageCount: 1 },
        measurements: [],
      };
    }

    // Set up the measure container width to match content area
    const contentWidth = this.layoutEngine.getContentAreaWidth();
    this.measureContainer.style.width = `${contentWidth}px`;
    this.measureContainer.style.position = 'absolute';
    this.measureContainer.style.left = '-9999px';
    this.measureContainer.style.top = '0';
    this.measureContainer.style.visibility = 'hidden';

    // Inject CSS if provided
    let styleEl: HTMLStyleElement | null = null;
    if (this.sourceCSS) {
      styleEl = document.createElement('style');
      styleEl.textContent = this.sourceCSS;
      this.measureContainer.appendChild(styleEl);
    }

    // Inject HTML content
    const contentWrapper = document.createElement('div');
    contentWrapper.innerHTML = this.sourceHTML;
    this.measureContainer.appendChild(contentWrapper);

    // Measure blocks
    const measurements = this.layoutEngine.measureBlocks(contentWrapper);

    // Paginate
    this.paginationResult = this.layoutEngine.paginate(measurements);

    // Clean up measure container
    this.measureContainer.innerHTML = '';

    // Notify listeners
    this.paginationCallbacks.forEach((cb) => cb(this.paginationResult));

    return { result: this.paginationResult, measurements };
  }

  /**
   * Re-paginate using the current content container's live DOM.
   * Called after user edits.
   */
  rePaginate(): PaginationResult {
    if (!this.contentContainer) {
      return this.paginationResult;
    }

    // Measure from the live content
    const measurements = this.layoutEngine.measureBlocks(this.contentContainer);
    this.paginationResult = this.layoutEngine.paginate(measurements);

    // Notify
    this.paginationCallbacks.forEach((cb) => cb(this.paginationResult));
    return this.paginationResult;
  }

  // ----------------------------------------------------------
  // Attach editing
  // ----------------------------------------------------------

  /**
   * Attach the editable manager to the content container
   * and set up change listener for re-pagination.
   */
  attachEditing(container: HTMLElement): void {
    this.contentContainer = container;
    this.editableManager.attach(container);

    // Re-paginate on content change
    this.editableManager.onChange(() => {
      // Update source HTML from live DOM
      this.sourceHTML = container.innerHTML;
      this.changeCallbacks.forEach((cb) => cb(this.sourceHTML));
    });
  }

  // ----------------------------------------------------------
  // Page config
  // ----------------------------------------------------------

  setPageConfig(config: Partial<PageConfig>): void {
    this.layoutEngine.setConfig(config);
  }

  // ----------------------------------------------------------
  // Event listeners
  // ----------------------------------------------------------

  onPagination(callback: (result: PaginationResult) => void): Unsubscribe {
    this.paginationCallbacks.add(callback);
    return () => {
      this.paginationCallbacks.delete(callback);
    };
  }

  onChange(callback: (html: string) => void): Unsubscribe {
    this.changeCallbacks.add(callback);
    return () => {
      this.changeCallbacks.delete(callback);
    };
  }

  // ----------------------------------------------------------
  // Content access
  // ----------------------------------------------------------

  getHTML(): string {
    if (this.contentContainer) {
      return this.contentContainer.innerHTML;
    }
    return this.sourceHTML;
  }

  getPlainText(): string {
    if (this.contentContainer) {
      return this.contentContainer.innerText || this.contentContainer.textContent || '';
    }
    return '';
  }

  // ----------------------------------------------------------
  // Cleanup
  // ----------------------------------------------------------

  destroy(): void {
    this.editableManager.detach();
    this.paginationCallbacks.clear();
    this.changeCallbacks.clear();
    this.measureContainer = null;
    this.contentContainer = null;
  }
}
