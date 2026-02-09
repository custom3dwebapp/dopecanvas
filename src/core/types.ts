// ============================================================
// DopeCanvas Core Types
// ============================================================

/** Named page size presets */
export type PageSizeName = 'letter' | 'a4' | 'legal';

/** Custom page dimensions in pixels */
export interface PageDimensions {
  width: number;
  height: number;
}

/** Page margins in pixels */
export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Full page configuration */
export interface PageConfig {
  size: PageSizeName | PageDimensions;
  margins: PageMargins;
}

/** A single page containing block element indices */
export interface PageContent {
  /** Indices into the flat block array */
  blockIndices: number[];
}

/** Result of the pagination algorithm */
export interface PaginationResult {
  pages: PageContent[];
  pageCount: number;
}

/** Block measurement info */
export interface BlockMeasurement {
  index: number;
  height: number;
  element: HTMLElement;
  breakBefore: boolean;
  breakAfter: boolean;
}

/** Toolbar context — what kind of element is selected */
export type ToolbarContext = 'text' | 'table' | 'image' | 'chart' | 'none';

/** Undo/redo snapshot */
export interface UndoSnapshot {
  html: string;
  timestamp: number;
}

/** Unsubscribe function returned by event listeners */
export type Unsubscribe = () => void;

/**
 * Comprehensive formatting state for the current selection.
 * Consumers use this to reflect active states in toolbar UI.
 */
export interface FormattingState {
  // Toggle states (document.queryCommandState)
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  justifyLeft: boolean;
  justifyCenter: boolean;
  justifyRight: boolean;
  justifyFull: boolean;
  orderedList: boolean;
  unorderedList: boolean;
  superscript: boolean;
  subscript: boolean;
  // Value states (document.queryCommandValue)
  fontName: string;
  fontSize: string;
  foreColor: string;
  backColor: string;
  formatBlock: string;
}

// ============================================================
// Page size presets (at 96 DPI)
// ============================================================

/** Page sizes in pixels at 96 DPI */
export const PAGE_SIZE_PRESETS: Record<PageSizeName, PageDimensions> = {
  letter: { width: 816, height: 1056 },  // 8.5 x 11 inches
  a4: { width: 794, height: 1123 },      // 210 x 297 mm
  legal: { width: 816, height: 1344 },   // 8.5 x 14 inches
};

/** Default margins: 1 inch (96px) on all sides */
export const DEFAULT_MARGINS: PageMargins = {
  top: 96,
  right: 96,
  bottom: 96,
  left: 96,
};

/** Default page config */
export const DEFAULT_PAGE_CONFIG: PageConfig = {
  size: 'letter',
  margins: { ...DEFAULT_MARGINS },
};
