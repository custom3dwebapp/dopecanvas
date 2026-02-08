// ============================================================
// PageSetupToolbar — Page size and margin controls
// ============================================================

import React, { useCallback } from 'react';
import type { PageConfig, PageSizeName } from '../../core/types';

interface PageSetupToolbarProps {
  pageConfig: PageConfig;
  pageCount: number;
  onPageConfigChange: (config: Partial<PageConfig>) => void;
}

export const PageSetupToolbar: React.FC<PageSetupToolbarProps> = ({
  pageConfig,
  pageCount,
  onPageConfigChange,
}) => {
  const handleSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value as PageSizeName;
      onPageConfigChange({ size: value });
    },
    [onPageConfigChange]
  );

  const handleMarginChange = useCallback(
    (side: keyof typeof pageConfig.margins) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Math.max(0, parseInt(e.target.value) || 0);
        onPageConfigChange({
          margins: {
            ...pageConfig.margins,
            [side]: value,
          },
        });
      },
    [pageConfig.margins, onPageConfigChange]
  );

  const currentSize =
    typeof pageConfig.size === 'string' ? pageConfig.size : 'custom';

  return (
    <div style={sectionStyle}>
      {/* Page size */}
      <label style={labelStyle}>
        Page:
        <select
          value={currentSize}
          onChange={handleSizeChange}
          style={selectStyle}
        >
          <option value="letter">Letter (8.5 x 11)</option>
          <option value="a4">A4 (210 x 297mm)</option>
          <option value="legal">Legal (8.5 x 14)</option>
        </select>
      </label>

      <div style={dividerStyle} />

      {/* Margins */}
      <span style={{ fontSize: '12px', color: '#666' }}>Margins (px):</span>
      <MarginInput
        label="T"
        value={pageConfig.margins.top}
        onChange={handleMarginChange('top')}
      />
      <MarginInput
        label="R"
        value={pageConfig.margins.right}
        onChange={handleMarginChange('right')}
      />
      <MarginInput
        label="B"
        value={pageConfig.margins.bottom}
        onChange={handleMarginChange('bottom')}
      />
      <MarginInput
        label="L"
        value={pageConfig.margins.left}
        onChange={handleMarginChange('left')}
      />

      <div style={dividerStyle} />

      {/* Page count */}
      <span style={{ fontSize: '12px', color: '#666' }}>
        {pageCount} {pageCount === 1 ? 'page' : 'pages'}
      </span>
    </div>
  );
};

// ----------------------------------------------------------
// MarginInput sub-component
// ----------------------------------------------------------

interface MarginInputProps {
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const MarginInput: React.FC<MarginInputProps> = ({ label, value, onChange }) => (
  <label style={marginLabelStyle} title={`${label} margin`}>
    {label}:
    <input
      type="number"
      value={value}
      onChange={onChange}
      style={marginInputStyle}
      min={0}
      max={300}
      step={12}
    />
  </label>
);

// ----------------------------------------------------------
// Styles
// ----------------------------------------------------------

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flexWrap: 'wrap',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '12px',
  color: '#666',
};

const selectStyle: React.CSSProperties = {
  height: '26px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ccc',
  borderRadius: '3px',
  fontSize: '12px',
  padding: '0 4px',
  cursor: 'pointer',
  backgroundColor: '#fff',
};

const dividerStyle: React.CSSProperties = {
  width: '1px',
  height: '20px',
  backgroundColor: '#ddd',
  margin: '0 4px',
};

const marginLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  fontSize: '11px',
  color: '#666',
};

const marginInputStyle: React.CSSProperties = {
  width: '44px',
  height: '24px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ccc',
  borderRadius: '3px',
  fontSize: '11px',
  textAlign: 'center',
  padding: '0 2px',
};
