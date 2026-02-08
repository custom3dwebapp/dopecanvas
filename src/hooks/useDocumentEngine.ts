// ============================================================
// useDocumentEngine — React hook wrapping DocumentEngine
// ============================================================

import { useRef, useState, useCallback, useEffect } from 'react';
import { DocumentEngine } from '../core/DocumentEngine';
import type { PageConfig, PaginationResult } from '../core/types';
import { DEFAULT_PAGE_CONFIG } from '../core/types';

interface UseDocumentEngineOptions {
  initialHTML?: string;
  initialCSS?: string;
  initialConfig?: PageConfig;
}

interface UseDocumentEngineReturn {
  engine: DocumentEngine;
  paginationResult: PaginationResult;
  pageConfig: PageConfig;
  loadHTML: (html: string, css?: string) => void;
  setPageConfig: (config: Partial<PageConfig>) => void;
  triggerPagination: () => void;
  getHTML: () => string;
  getPlainText: () => string;
}

export function useDocumentEngine(
  options: UseDocumentEngineOptions = {}
): UseDocumentEngineReturn {
  const {
    initialHTML = '',
    initialCSS = '',
    initialConfig = DEFAULT_PAGE_CONFIG,
  } = options;

  const engineRef = useRef<DocumentEngine>(new DocumentEngine(initialConfig));
  const [paginationResult, setPaginationResult] = useState<PaginationResult>({
    pages: [{ blockIndices: [] }],
    pageCount: 1,
  });
  const [pageConfig, setPageConfigState] = useState<PageConfig>(initialConfig);

  // Load HTML into engine
  const loadHTML = useCallback((html: string, css?: string) => {
    engineRef.current.loadHTML(html, css);
  }, []);

  // Set page configuration
  const setPageConfig = useCallback((config: Partial<PageConfig>) => {
    engineRef.current.setPageConfig(config);
    setPageConfigState(engineRef.current.getPageConfig());
  }, []);

  // Trigger re-pagination
  const triggerPagination = useCallback(() => {
    const { result } = engineRef.current.runPagination();
    setPaginationResult(result);
  }, []);

  // Get current HTML content
  const getHTML = useCallback(() => {
    return engineRef.current.getHTML();
  }, []);

  // Get plain text
  const getPlainText = useCallback(() => {
    return engineRef.current.getPlainText();
  }, []);

  // Load initial HTML
  useEffect(() => {
    if (initialHTML) {
      engineRef.current.loadHTML(initialHTML, initialCSS);
    }
  }, [initialHTML, initialCSS]);

  // Subscribe to pagination events
  useEffect(() => {
    const unsub = engineRef.current.onPagination((result) => {
      setPaginationResult(result);
    });
    return unsub;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      engineRef.current.destroy();
    };
  }, []);

  return {
    engine: engineRef.current,
    paginationResult,
    pageConfig,
    loadHTML,
    setPageConfig,
    triggerPagination,
    getHTML,
    getPlainText,
  };
}
