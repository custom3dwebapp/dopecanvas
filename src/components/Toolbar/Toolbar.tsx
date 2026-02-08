// ============================================================
// Toolbar — Main toolbar container with context switching
// ============================================================

import React from 'react';
import { TextToolbar } from './TextToolbar';
import { PageSetupToolbar } from './PageSetupToolbar';
import type { PageConfig } from '../../core/types';

interface ToolbarProps {
  pageConfig: PageConfig;
  pageCount: number;
  onExecCommand: (command: string, value?: string) => void;
  onPageConfigChange: (config: Partial<PageConfig>) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  pageConfig,
  pageCount,
  onExecCommand,
  onPageConfigChange,
}) => {
  return (
    <div style={toolbarContainerStyle}>
      {/* Top row: Text formatting */}
      <div style={toolbarRowStyle}>
        <TextToolbar onExecCommand={onExecCommand} />
      </div>

      {/* Bottom row: Page setup */}
      <div style={toolbarRowStyle}>
        <PageSetupToolbar
          pageConfig={pageConfig}
          pageCount={pageCount}
          onPageConfigChange={onPageConfigChange}
        />
      </div>
    </div>
  );
};

// ----------------------------------------------------------
// Styles
// ----------------------------------------------------------

const toolbarContainerStyle: React.CSSProperties = {
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: '#d0d0d0',
  backgroundColor: '#f8f8f8',
  padding: '4px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  flexShrink: 0,
  zIndex: 10,
};

const toolbarRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  minHeight: '32px',
};
