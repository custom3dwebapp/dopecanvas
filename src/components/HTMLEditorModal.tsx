// ============================================================
// HTMLEditorModal — Raw HTML editor for a single block
// ============================================================
// Full-screen modal with a code-editor-style textarea.
// Rendered as a React Portal to document.body.
// ============================================================

import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface HTMLEditorModalProps {
  /** The current HTML of the block being edited */
  html: string;
  /** Called with the updated HTML when the user saves */
  onSave: (html: string) => void;
  /** Called when the user cancels editing */
  onCancel: () => void;
}

export const HTMLEditorModal: React.FC<HTMLEditorModalProps> = ({
  html,
  onSave,
  onCancel,
}) => {
  const [value, setValue] = useState(html);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl+Enter → save
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSave(value);
    }
    // Escape → cancel
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
    // Tab → insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target as HTMLTextAreaElement;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const updated = value.substring(0, start) + '  ' + value.substring(end);
      setValue(updated);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  };

  return createPortal(
    <div style={overlayStyle} onClick={onCancel}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>Edit Block HTML</span>
          <span style={{ fontSize: '11px', color: '#888' }}>
            ⌘Enter to save &middot; Escape to cancel
          </span>
        </div>

        {/* Editor */}
        <textarea
          style={textareaStyle}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoFocus
        />

        {/* Footer */}
        <div style={footerStyle}>
          <button
            style={cancelBtnStyle}
            onClick={onCancel}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.borderColor = '#888';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.borderColor = '#555';
            }}
          >
            Cancel
          </button>
          <button
            style={saveBtnStyle}
            onClick={() => onSave(value)}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = '#0055dd';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = '#0066ff';
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ----------------------------------------------------------
// Styles
// ----------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
};

const modalStyle: React.CSSProperties = {
  width: 'min(800px, 90vw)',
  height: 'min(600px, 80vh)',
  background: '#1e1e1e',
  borderRadius: '10px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  background: '#2d2d2d',
  color: '#ccc',
  borderBottom: '1px solid #444',
};

const textareaStyle: React.CSSProperties = {
  flex: 1,
  background: '#1e1e1e',
  color: '#d4d4d4',
  border: 'none',
  padding: '16px',
  fontFamily: "'SF Mono', 'Fira Code', 'Consolas', 'Monaco', monospace",
  fontSize: '13px',
  lineHeight: '1.6',
  resize: 'none',
  outline: 'none',
  tabSize: 2,
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  padding: '12px 16px',
  background: '#2d2d2d',
  borderTop: '1px solid #444',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '6px 16px',
  border: '1px solid #555',
  borderRadius: '6px',
  background: 'transparent',
  color: '#ccc',
  cursor: 'pointer',
  fontSize: '13px',
  transition: 'border-color 0.15s',
};

const saveBtnStyle: React.CSSProperties = {
  padding: '6px 16px',
  border: 'none',
  borderRadius: '6px',
  background: '#0066ff',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
  transition: 'background 0.15s',
};
