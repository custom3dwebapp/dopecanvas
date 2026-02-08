// ============================================================
// TextToolbar — Text formatting tools
// ============================================================

import React, { useCallback, useRef } from 'react';
import { useFormattingState } from '../../hooks/useSelectionContext';

interface TextToolbarProps {
  onExecCommand: (command: string, value?: string) => void;
}

export const TextToolbar: React.FC<TextToolbarProps> = ({ onExecCommand }) => {
  const formatState = useFormattingState();

  // ----------------------------------------------------------
  // Selection save / restore
  // ----------------------------------------------------------
  // Toolbar controls (selects, color pickers) steal focus from
  // the contentEditable area, clearing the browser selection.
  // We save the range on mouseDown (before focus moves) and
  // restore it before executing the formatting command.
  // ----------------------------------------------------------

  const savedRangeRef = useRef<Range | null>(null);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const range = savedRangeRef.current;
    if (!range) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, []);

  const handleCommand = useCallback(
    (command: string, value?: string) => (e: React.MouseEvent) => {
      e.preventDefault(); // Don't steal focus from content
      onExecCommand(command, value);
    },
    [onExecCommand]
  );

  const handleFontSize = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      restoreSelection();
      onExecCommand('fontSize', e.target.value);
    },
    [onExecCommand, restoreSelection]
  );

  const handleHeading = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      restoreSelection();
      const value = e.target.value;
      if (value === 'p') {
        onExecCommand('formatBlock', 'p');
      } else {
        onExecCommand('formatBlock', value);
      }
    },
    [onExecCommand, restoreSelection]
  );

  const handleForeColor = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      restoreSelection();
      onExecCommand('foreColor', e.target.value);
    },
    [onExecCommand, restoreSelection]
  );

  const handleBackColor = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      restoreSelection();
      onExecCommand('hiliteColor', e.target.value);
    },
    [onExecCommand, restoreSelection]
  );

  return (
    <div style={toolbarSectionStyle}>
      {/* Block format */}
      <select
        onChange={handleHeading}
        defaultValue="p"
        style={selectStyle}
        title="Block Format"
        onMouseDown={saveSelection}
      >
        <option value="p">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="h4">Heading 4</option>
        <option value="h5">Heading 5</option>
        <option value="h6">Heading 6</option>
      </select>

      <div style={dividerStyle} />

      {/* Font size */}
      <select
        onChange={handleFontSize}
        defaultValue="3"
        style={selectStyle}
        title="Font Size"
        onMouseDown={saveSelection}
      >
        <option value="1">8pt</option>
        <option value="2">10pt</option>
        <option value="3">12pt</option>
        <option value="4">14pt</option>
        <option value="5">18pt</option>
        <option value="6">24pt</option>
        <option value="7">36pt</option>
      </select>

      <div style={dividerStyle} />

      {/* Inline formatting */}
      <ToolbarButton
        icon="B"
        title="Bold (Ctrl+B)"
        active={formatState.bold}
        onMouseDown={handleCommand('bold')}
        extraStyle={{ fontWeight: 'bold' }}
      />
      <ToolbarButton
        icon="I"
        title="Italic (Ctrl+I)"
        active={formatState.italic}
        onMouseDown={handleCommand('italic')}
        extraStyle={{ fontStyle: 'italic' }}
      />

      <div style={dividerStyle} />

      {/* Colors */}
      <label style={colorLabelStyle} title="Text Color" onMouseDown={saveSelection}>
        A
        <input
          type="color"
          defaultValue="#000000"
          onChange={handleForeColor}
          style={colorInputStyle}
        />
      </label>
      <label style={colorLabelStyle} title="Highlight Color" onMouseDown={saveSelection}>
        <span style={{ backgroundColor: '#ffff00', padding: '0 2px' }}>A</span>
        <input
          type="color"
          defaultValue="#ffff00"
          onChange={handleBackColor}
          style={colorInputStyle}
        />
      </label>
    </div>
  );
};

// ----------------------------------------------------------
// ToolbarButton sub-component
// ----------------------------------------------------------

interface ToolbarButtonProps {
  icon: string;
  title: string;
  active?: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  extraStyle?: React.CSSProperties;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon,
  title,
  active,
  onMouseDown,
  extraStyle,
}) => {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={onMouseDown}
      style={{
        width: '28px',
        height: '28px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: active ? '#b0b5bd' : 'transparent',
        borderRadius: '3px',
        backgroundColor: active ? '#d0d5dd' : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        color: '#333',
        padding: 0,
        fontFamily: 'inherit',
        ...extraStyle,
      }}
      dangerouslySetInnerHTML={{ __html: icon }}
    />
  );
};

// ----------------------------------------------------------
// Styles
// ----------------------------------------------------------

const toolbarSectionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  flexWrap: 'wrap',
};

const selectStyle: React.CSSProperties = {
  height: '28px',
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

const colorLabelStyle: React.CSSProperties = {
  position: 'relative',
  width: '28px',
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 'bold',
};

const colorInputStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  width: '100%',
  height: '4px',
  padding: 0,
  borderWidth: 0,
  borderStyle: 'none',
  cursor: 'pointer',
};
