// ============================================================
// App — DopeCanvas Demo Application
// ============================================================
// Loads a sample LLM-generated report and renders it in the
// DopeCanvas paged document editor.
//
// Demonstrates the ref-based API: all toolbar actions (bold,
// italic, page config, etc.) are called via canvasRef.current.
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { DopeCanvas } from 'dopecanvas';
import type { DopeCanvasHandle } from 'dopecanvas';
import 'dopecanvas/style.css';

// Sample reports (loaded from public folder)
const SAMPLE_REPORTS = [
  { id: 'team', label: 'Team Overview', url: '/sample-report.html' },
  { id: 'charts', label: 'Sales Report (Charts)', url: '/sample-report-charts.html' },
];

function App() {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState(SAMPLE_REPORTS[0].id);
  const [showAPIPanel, setShowAPIPanel] = useState(false);
  const [apiOutput, setApiOutput] = useState<string>('');

  // Ref to the DopeCanvas API handle
  const canvasRef = useRef<DopeCanvasHandle>(null);

  // Load selected sample report
  useEffect(() => {
    const report = SAMPLE_REPORTS.find((r) => r.id === activeReport) || SAMPLE_REPORTS[0];
    setLoading(true);
    fetch(report.url)
      .then((res) => res.text())
      .then((text) => {
        setHtml(text);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load sample report:', err);
        const fallback = `
          <h1 style="color: #1a1a2e; font-family: Georgia, serif;">DopeCanvas</h1>
          <p style="color: #666; line-height: 1.6;">
            Welcome to DopeCanvas — an LLM-centric paged document framework. 
            Click any text to edit it. Use the API buttons below to format text.
          </p>
          <p style="color: #333; line-height: 1.6;">
            This is a fallback document. Place a <code>sample-report.html</code> file in the 
            <code>public/</code> folder for a full demo.
          </p>
        `;
        setHtml(fallback);
        setLoading(false);
      });
  }, [activeReport]);

  // API panel actions — all go through canvasRef
  const handleGetHTML = useCallback(() => {
    if (!canvasRef.current) return;
    setApiOutput(canvasRef.current.getHTML());
    setShowAPIPanel(true);
  }, []);

  const handleGetPlainText = useCallback(() => {
    if (!canvasRef.current) return;
    setApiOutput(canvasRef.current.getPlainText());
    setShowAPIPanel(true);
  }, []);

  const handleBold = useCallback(() => {
    canvasRef.current?.execCommand('bold');
  }, []);

  const handleItalic = useCallback(() => {
    canvasRef.current?.execCommand('italic');
  }, []);

  const handleUndo = useCallback(() => {
    canvasRef.current?.undo();
  }, []);

  const handleRedo = useCallback(() => {
    canvasRef.current?.redo();
  }, []);

  const handlePageInfo = useCallback(() => {
    if (!canvasRef.current) return;
    const config = canvasRef.current.getPageConfig();
    const count = canvasRef.current.getPageCount();
    setApiOutput(JSON.stringify({ pageCount: count, config }, null, 2));
    setShowAPIPanel(true);
  }, []);

  if (loading) {
    return (
      <div style={loadingStyle}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading document...</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* DopeCanvas — no built-in toolbar, all actions via ref */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <DopeCanvas
          ref={canvasRef}
          html={html}
        />
      </div>

      {/* API demo bar at bottom */}
      <div style={apiBarStyle}>
        <span style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>
          Reports:
        </span>
        {SAMPLE_REPORTS.map((report) => (
          <button
            key={report.id}
            onClick={() => setActiveReport(report.id)}
            style={{
              ...apiButtonStyle,
              backgroundColor: activeReport === report.id ? '#1a1a2e' : '#fff',
              color: activeReport === report.id ? '#fff' : '#333',
              borderColor: activeReport === report.id ? '#1a1a2e' : '#ccc',
            }}
          >
            {report.label}
          </button>
        ))}

        <span style={dividerStyle} />

        <span style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>
          Format:
        </span>
        <button onMouseDown={(e) => { e.preventDefault(); handleBold(); }} style={{ ...apiButtonStyle, fontWeight: 'bold' }}>
          B
        </button>
        <button onMouseDown={(e) => { e.preventDefault(); handleItalic(); }} style={{ ...apiButtonStyle, fontStyle: 'italic' }}>
          I
        </button>
        <button onClick={handleUndo} style={apiButtonStyle}>
          Undo
        </button>
        <button onClick={handleRedo} style={apiButtonStyle}>
          Redo
        </button>

        <span style={dividerStyle} />

        <span style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>
          API:
        </span>
        <button onClick={handleGetHTML} style={apiButtonStyle}>
          getHTML()
        </button>
        <button onClick={handleGetPlainText} style={apiButtonStyle}>
          getPlainText()
        </button>
        <button onClick={handlePageInfo} style={apiButtonStyle}>
          getPageInfo()
        </button>
        <button
          onClick={() => setShowAPIPanel(!showAPIPanel)}
          style={apiButtonStyle}
        >
          {showAPIPanel ? 'Hide Output' : 'Show Output'}
        </button>
      </div>

      {/* API output panel */}
      {showAPIPanel && (
        <div style={apiPanelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <strong style={{ fontSize: '12px', color: '#666' }}>API Output</strong>
            <button
              onClick={() => setShowAPIPanel(false)}
              style={{ ...apiButtonStyle, padding: '2px 8px' }}
            >
              Close
            </button>
          </div>
          <pre style={apiPreStyle}>
            {apiOutput || '(No output yet — click an API method above)'}
          </pre>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------
// Styles
// ----------------------------------------------------------

const loadingStyle: React.CSSProperties = {
  height: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#e8e8e8',
};

const apiBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 12px',
  backgroundColor: '#f0f0f0',
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderTopColor: '#d0d0d0',
  flexShrink: 0,
  flexWrap: 'wrap',
};

const dividerStyle: React.CSSProperties = {
  width: '1px',
  height: '16px',
  backgroundColor: '#d0d0d0',
  margin: '0 4px',
};

const apiButtonStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '11px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ccc',
  borderRadius: '3px',
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontFamily: 'monospace',
};

const apiPanelStyle: React.CSSProperties = {
  height: '200px',
  backgroundColor: '#1e1e1e',
  padding: '12px',
  overflow: 'auto',
  flexShrink: 0,
};

const apiPreStyle: React.CSSProperties = {
  color: '#d4d4d4',
  fontSize: '11px',
  fontFamily: 'Menlo, Monaco, Consolas, monospace',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  margin: 0,
  lineHeight: 1.5,
};

export default App;
