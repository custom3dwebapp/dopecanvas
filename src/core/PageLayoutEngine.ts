// ============================================================
// PageLayoutEngine — Pagination algorithm
// ============================================================
// Pure TypeScript class with no React dependency.
// Takes a container of block elements, measures them, and
// distributes them across fixed-size pages.
// ============================================================

import type {
  PageConfig,
  PageDimensions,
  PageSizeName,
  PaginationResult,
  BlockMeasurement,
} from './types';
import {
  PAGE_SIZE_PRESETS,
  DEFAULT_PAGE_CONFIG,
} from './types';

export class PageLayoutEngine {
  private config: PageConfig;

  constructor(config: PageConfig = DEFAULT_PAGE_CONFIG) {
    this.config = { ...config };
  }

  // ----------------------------------------------------------
  // Config accessors
  // ----------------------------------------------------------

  getConfig(): PageConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<PageConfig>): void {
    if (config.size !== undefined) {
      this.config.size = config.size;
    }
    if (config.margins !== undefined) {
      this.config.margins = { ...config.margins };
    }
  }

  /** Resolve page size name to pixel dimensions */
  getPageDimensions(): PageDimensions {
    if (typeof this.config.size === 'string') {
      return PAGE_SIZE_PRESETS[this.config.size as PageSizeName];
    }
    return this.config.size;
  }

  /** Usable content area height (page height minus top+bottom margins) */
  getContentAreaHeight(): number {
    const dims = this.getPageDimensions();
    return dims.height - this.config.margins.top - this.config.margins.bottom;
  }

  /** Usable content area width (page width minus left+right margins) */
  getContentAreaWidth(): number {
    const dims = this.getPageDimensions();
    return dims.width - this.config.margins.left - this.config.margins.right;
  }

  // ----------------------------------------------------------
  // Measurement
  // ----------------------------------------------------------

  /**
   * Measure all direct child block elements of the container.
   * The container should be styled to match the content area width
   * so that measurements reflect actual rendered heights.
   */
  measureBlocks(container: HTMLElement): BlockMeasurement[] {
    const children = Array.from(container.children) as HTMLElement[];
    const measurements: BlockMeasurement[] = [];

    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      const style = window.getComputedStyle(el);

      // Check for CSS break-before / break-after
      const breakBefore =
        style.getPropertyValue('break-before') === 'page' ||
        style.getPropertyValue('page-break-before') === 'always';
      const breakAfter =
        style.getPropertyValue('break-after') === 'page' ||
        style.getPropertyValue('page-break-after') === 'always';

      // Use getBoundingClientRect for precise measurement including margins
      const rect = el.getBoundingClientRect();
      const marginTop = parseFloat(style.marginTop) || 0;
      const marginBottom = parseFloat(style.marginBottom) || 0;
      const totalHeight = rect.height + marginTop + marginBottom;

      measurements.push({
        index: i,
        height: totalHeight,
        element: el,
        breakBefore,
        breakAfter,
      });
    }

    return measurements;
  }

  // ----------------------------------------------------------
  // Pagination
  // ----------------------------------------------------------

  /**
   * Paginate: distribute measured blocks across pages.
   * 
   * Algorithm:
   * 1. Walk blocks sequentially
   * 2. Accumulate height on current page
   * 3. When a block would overflow, start a new page
   * 4. Respect break-before / break-after CSS
   * 5. If a single block is taller than a page, give it its own page
   */
  paginate(measurements: BlockMeasurement[]): PaginationResult {
    if (measurements.length === 0) {
      return { pages: [{ blockIndices: [] }], pageCount: 1 };
    }

    const contentHeight = this.getContentAreaHeight();
    const pages: { blockIndices: number[] }[] = [];
    let currentPage: number[] = [];
    let currentHeight = 0;

    for (let i = 0; i < measurements.length; i++) {
      const block = measurements[i];

      // Force a new page if break-before is set (and current page has content)
      if (block.breakBefore && currentPage.length > 0) {
        pages.push({ blockIndices: currentPage });
        currentPage = [];
        currentHeight = 0;
      }

      // Check if adding this block would overflow the current page
      if (currentHeight + block.height > contentHeight && currentPage.length > 0) {
        // Current page is full — start a new one
        pages.push({ blockIndices: currentPage });
        currentPage = [];
        currentHeight = 0;
      }

      // Add block to current page
      currentPage.push(block.index);
      currentHeight += block.height;

      // Force a new page after this block if break-after is set
      if (block.breakAfter) {
        pages.push({ blockIndices: currentPage });
        currentPage = [];
        currentHeight = 0;
      }
    }

    // Push the last page if it has content
    if (currentPage.length > 0) {
      pages.push({ blockIndices: currentPage });
    }

    // Ensure at least one page
    if (pages.length === 0) {
      pages.push({ blockIndices: [] });
    }

    return {
      pages,
      pageCount: pages.length,
    };
  }
}
