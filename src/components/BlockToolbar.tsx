// ============================================================
// BlockToolbar — Hover controls for individual content blocks
// ============================================================
// Shows add / edit-HTML / delete actions when a block is hovered.
// Positioned absolutely in the left margin of the block.
// ============================================================

import React, { useState } from 'react';

interface BlockToolbarProps {
  /** Whether the toolbar is currently visible */
  visible: boolean;
  /** Add a new empty block below this one */
  onAddBelow: () => void;
  /** Open the HTML source editor for this block */
  onEditHTML: () => void;
  /** Delete this block */
  onDelete: () => void;
}

export const BlockToolbar: React.FC<BlockToolbarProps> = ({
  visible,
  onAddBelow,
  onEditHTML,
  onDelete,
}) => (
  <div
    className="dopecanvas-block-toolbar"
    style={{
      ...toolbarStyle,
      display: visible ? 'flex' : 'none',
    }}
    onMouseDown={(e) => e.preventDefault()}
  >
    <Btn onClick={onAddBelow} title="Add block below">
      <PlusIcon />
    </Btn>
    <Btn onClick={onEditHTML} title="Edit HTML">
      <CodeIcon />
    </Btn>
    <Btn onClick={onDelete} title="Delete block" danger>
      <TrashIcon />
    </Btn>
  </div>
);

// ----------------------------------------------------------
// Tiny SVG icons (no external dependencies)
// ----------------------------------------------------------

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="7" y1="3" x2="7" y2="11" />
    <line x1="3" y1="7" x2="11" y2="7" />
  </svg>
);

const CodeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4.5,3 1.5,7 4.5,11" />
    <polyline points="9.5,3 12.5,7 9.5,11" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 4h9M5 4V2.5h4V4M3.5 4l.5 8h6l.5-8" />
  </svg>
);

// ----------------------------------------------------------
// Button sub-component with hover effect
// ----------------------------------------------------------

const Btn: React.FC<{
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}> = ({ onClick, title, children, danger }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...btnStyle,
        background: hovered
          ? danger
            ? '#fff0f0'
            : '#f0f0f0'
          : 'transparent',
        color: hovered && danger ? '#d32f2f' : '#666',
      }}
    >
      {children}
    </button>
  );
};

// ----------------------------------------------------------
// Styles
// ----------------------------------------------------------

const toolbarStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: -40,
  flexDirection: 'column',
  gap: '1px',
  zIndex: 100,
  background: '#fff',
  borderRadius: '6px',
  boxShadow: '0 1px 5px rgba(0,0,0,0.12)',
  padding: '3px',
  paddingRight: '6px',
};

const btnStyle: React.CSSProperties = {
  width: '30px',
  height: '26px',
  border: 'none',
  cursor: 'pointer',
  borderRadius: '4px',
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'background 0.1s, color 0.1s',
};
