// ============================================================
// DopeCanvas — Public API
// ============================================================
// Barrel export for the framework.
// ============================================================

// Library styles — bundled into dopecanvas.css by Vite library build
import './dopecanvas.css';

// Main component
export { DopeCanvas } from './components/DopeCanvas';
export type { DopeCanvasProps } from './components/DopeCanvas';

// Core engines
export { PageLayoutEngine } from './core/PageLayoutEngine';
export { EditableManager } from './core/EditableManager';
export { DocumentEngine } from './core/DocumentEngine';

// API
export { DocumentAPI } from './api/DocumentAPI';

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
