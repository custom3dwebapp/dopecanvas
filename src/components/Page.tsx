// ============================================================
// Page — Single page frame component
// ============================================================
// Renders a fixed-size white page with margins and page number.
// ============================================================

import React from 'react';
import type { PageDimensions, PageMargins } from '../core/types';

interface PageProps {
  /** Page dimensions in pixels */
  dimensions: PageDimensions;
  /** Page margins in pixels */
  margins: PageMargins;
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Total number of pages */
  totalPages: number;
  /** The content blocks to render inside the page */
  children: React.ReactNode;
}

export const Page: React.FC<PageProps> = ({
  dimensions,
  margins,
  pageNumber,
  totalPages,
  children,
}) => {
  return (
    <div
      className="dopecanvas-page"
      style={{
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Content area with margins */}
      <div
        className="dopecanvas-page-content"
        style={{
          paddingTop: `${margins.top}px`,
          paddingRight: `${margins.right}px`,
          paddingBottom: `${margins.bottom}px`,
          paddingLeft: `${margins.left}px`,
          height: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>

      {/* Page number footer */}
      <div
        className="dopecanvas-page-number"
        style={{
          position: 'absolute',
          bottom: `${Math.max(margins.bottom / 3, 16)}px`,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: '11px',
          color: '#999',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {pageNumber} / {totalPages}
      </div>
    </div>
  );
};
