// ============================================================
// DopeCanvas — Public API
// ============================================================
// Barrel export for the framework.
// ============================================================

// Library styles — bundled into dopecanvas.css by Vite library build
import './dopecanvas.css';

// Main component & ref handle
export { DopeCanvas } from './components/DopeCanvas';
export type { DopeCanvasProps, DopeCanvasHandle } from './components/DopeCanvas';

// Core engines
export { PageLayoutEngine } from './core/PageLayoutEngine';
export { EditableManager } from './core/EditableManager';
export { DocumentEngine } from './core/DocumentEngine';
export { trySplitBlock, recombineSplitBlocks } from './core/BlockSplitter';
export type { SplitResult } from './core/BlockSplitter';

// API
export { DocumentAPI } from './api/DocumentAPI';

// Toolbar components (optional — build your own or use these)
export { Toolbar } from './components/Toolbar/Toolbar';
export { TextToolbar } from './components/Toolbar/TextToolbar';
export { PageSetupToolbar } from './components/Toolbar/PageSetupToolbar';

// Types
export type {
  PageConfig,
  PageSizeName,
  PageDimensions,
  PageMargins,
  PaginationResult,
  PageContent,
  BlockMeasurement,
  ToolbarContext,
  FormattingState,
  Unsubscribe,
} from './core/types';

export {
  PAGE_SIZE_PRESETS,
  DEFAULT_MARGINS,
  DEFAULT_PAGE_CONFIG,
} from './core/types';

// Hooks
export { useDocumentEngine } from './hooks/useDocumentEngine';
export { useSelectionContext, useFormattingState } from './hooks/useSelectionContext';
export { useSelectionSaver } from './hooks/useSelectionSaver';
export type { SelectionSaver } from './hooks/useSelectionSaver';
