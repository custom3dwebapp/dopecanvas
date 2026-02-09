// ============================================================
// TextToolbar — Comprehensive text formatting tools
// ============================================================
// Provides a full Word-style formatting toolbar using the
// useFormattingState and useSelectionSaver hooks from the
// dopecanvas library. Consumers can use this drop-in component
// or build their own toolbar using the same hooks.
// ============================================================

import React, { useCallback } from 'react';
import { useFormattingState } from '../../hooks/useSelectionContext';
import { useSelectionSaver } from '../../hooks/useSelectionSaver';

interface TextToolbarProps {
  onExecCommand: (command: string, value?: string) => void;
}

export const TextToolbar: React.FC<TextToolbarProps> = ({ onExecCommand }) => {
  const fmt = useFormattingState();
  const { saveSelection, restoreAndExec } = useSelectionSaver();

  // ----------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------

  /** Toggle command (bold, italic, etc.) — prevent default to keep focus */
  const toggle = useCallback(
    (command: string, value?: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      onExecCommand(command, value);
    },
    [onExecCommand]
  );

  /** Select-based command — restore selection before executing */
  const handleSelect = useCallback(
    (command: string) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      restoreAndExec(() => onExecCommand(command, e.target.value));
    },
    [onExecCommand, restoreAndExec]
  );

  /** Color input — restore selection before executing */
  const handleColor = useCallback(
    (command: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      restoreAndExec(() => onExecCommand(command, e.target.value));
    },
    [onExecCommand, restoreAndExec]
  );

  /** Insert a link via prompt */
  const handleInsertLink = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const url = prompt('Enter URL:');
      if (url) onExecCommand('createLink', url);
    },
    [onExecCommand]
  );

  return (
    <div style={toolbarSectionStyle}>
      {/* ---- Block format ---- */}
      <select
        value={fmt.formatBlock}
        onChange={handleSelect('formatBlock')}
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

      <Divider />

      {/* ---- Font family ---- */}
      <select
        value={fmt.fontName.replace(/['"]/g, '')}
        onChange={handleSelect('fontName')}
        style={{ ...selectStyle, width: 110 }}
        title="Font Family"
        onMouseDown={saveSelection}
      >
        <option value="Arial">Arial</option>
        <option value="Georgia">Georgia</option>
        <option value="Times New Roman">Times New Roman</option>
        <option value="Courier New">Courier New</option>
        <option value="Verdana">Verdana</option>
        <option value="Trebuchet MS">Trebuchet MS</option>
        <option value="Comic Sans MS">Comic Sans MS</option>
        <option value="Impact">Impact</option>
        <option value="system-ui">System UI</option>
      </select>

      {/* ---- Font size ---- */}
      <select
        value={fmt.fontSize}
        onChange={handleSelect('fontSize')}
        style={{ ...selectStyle, width: 56 }}
        title="Font Size"
        onMouseDown={saveSelection}
      >
        <option value="1">8</option>
        <option value="2">10</option>
        <option value="3">12</option>
        <option value="4">14</option>
        <option value="5">18</option>
        <option value="6">24</option>
        <option value="7">36</option>
      </select>

      <Divider />

      {/* ---- Inline formatting ---- */}
      <Btn icon="B" title="Bold (Ctrl+B)" active={fmt.bold} onMouseDown={toggle('bold')} extraStyle={{ fontWeight: 700 }} />
      <Btn icon="I" title="Italic (Ctrl+I)" active={fmt.italic} onMouseDown={toggle('italic')} extraStyle={{ fontStyle: 'italic' }} />
      <Btn icon="U" title="Underline (Ctrl+U)" active={fmt.underline} onMouseDown={toggle('underline')} extraStyle={{ textDecoration: 'underline' }} />
      <Btn icon="S" title="Strikethrough" active={fmt.strikethrough} onMouseDown={toggle('strikethrough')} extraStyle={{ textDecoration: 'line-through' }} />
      <Btn icon="x&#x00B2;" title="Superscript" active={fmt.superscript} onMouseDown={toggle('superscript')} />
      <Btn icon="x&#x2082;" title="Subscript" active={fmt.subscript} onMouseDown={toggle('subscript')} />

      <Divider />

      {/* ---- Colors ---- */}
      <ColorPicker label="A" title="Text Color" defaultValue="#000000" onChange={handleColor('foreColor')} onMouseDown={saveSelection} />
      <ColorPicker label="A" title="Highlight Color" defaultValue="#ffff00" onChange={handleColor('hiliteColor')} onMouseDown={saveSelection} highlight />

      <Divider />

      {/* ---- Alignment ---- */}
      <Btn icon="&#x2261;" title="Align Left" active={fmt.justifyLeft} onMouseDown={toggle('justifyLeft')} />
      <Btn icon="&#x2263;" title="Align Center" active={fmt.justifyCenter} onMouseDown={toggle('justifyCenter')} />
      <Btn icon="&#x2262;" title="Align Right" active={fmt.justifyRight} onMouseDown={toggle('justifyRight')} />
      <Btn icon="&#x2630;" title="Justify" active={fmt.justifyFull} onMouseDown={toggle('justifyFull')} />

      <Divider />

      {/* ---- Lists ---- */}
      <Btn icon="&#x2022;" title="Bullet List" active={fmt.unorderedList} onMouseDown={toggle('insertUnorderedList')} />
      <Btn icon="1." title="Numbered List" active={fmt.orderedList} onMouseDown={toggle('insertOrderedList')} extraStyle={{ fontSize: '11px', fontWeight: 600 }} />

      {/* ---- Indent ---- */}
      <Btn icon="&#x21E4;" title="Decrease Indent" onMouseDown={toggle('outdent')} />
      <Btn icon="&#x21E5;" title="Increase Indent" onMouseDown={toggle('indent')} />

      <Divider />

      {/* ---- Extras ---- */}
      <Btn icon="&#x1F517;" title="Insert Link" onMouseDown={handleInsertLink} />
      <Btn icon="&mdash;" title="Horizontal Rule" onMouseDown={toggle('insertHorizontalRule')} />
      <Btn icon="T&#x0338;" title="Clear Formatting" onMouseDown={toggle('removeFormat')} />
    </div>
  );
};

// ----------------------------------------------------------
// Sub-components
// ----------------------------------------------------------

interface BtnProps {
  icon: string;
  title: string;
  active?: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  extraStyle?: React.CSSProperties;
}

const Btn: React.FC<BtnProps> = ({ icon, title, active, onMouseDown, extraStyle }) => (
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

const Divider: React.FC = () => <div style={dividerStyle} />;

interface ColorPickerProps {
  label: string;
  title: string;
  defaultValue: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMouseDown: () => void;
  highlight?: boolean;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  title,
  defaultValue,
  onChange,
  onMouseDown,
  highlight,
}) => (
  <label style={colorLabelStyle} title={title} onMouseDown={onMouseDown}>
    {highlight ? (
      <span style={{ backgroundColor: '#ffff00', padding: '0 2px' }}>{label}</span>
    ) : (
      label
    )}
    <input
      type="color"
      defaultValue={defaultValue}
      onChange={onChange}
      style={colorInputStyle}
    />
  </label>
);

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
