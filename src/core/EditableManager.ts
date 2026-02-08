// ============================================================
// EditableManager — contentEditable integration
// ============================================================
// Manages making block elements editable, tracking changes
// via MutationObserver, and providing undo/redo.
// ============================================================

import type { UndoSnapshot, Unsubscribe, ToolbarContext } from './types';

export type ChangeCallback = () => void;
export type ContextChangeCallback = (context: ToolbarContext) => void;

export class EditableManager {
  private observer: MutationObserver | null = null;
  private changeCallbacks: Set<ChangeCallback> = new Set();
  private contextCallbacks: Set<ContextChangeCallback> = new Set();
  private undoStack: UndoSnapshot[] = [];
  private redoStack: UndoSnapshot[] = [];
  private container: HTMLElement | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private selectionHandler: (() => void) | null = null;
  private currentContext: ToolbarContext = 'none';

  private static readonly MAX_UNDO_STACK = 100;
  private static readonly DEBOUNCE_MS = 150;

  // ----------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------

  /**
   * Attach to a container element. Sets up contentEditable on
   * all direct child blocks and starts observing changes.
   */
  attach(container: HTMLElement): void {
    this.detach(); // Clean up any previous attachment
    this.container = container;

    // Make all direct children editable
    this.makeChildrenEditable(container);

    // Take initial snapshot for undo
    this.pushUndoSnapshot();

    // Start observing mutations
    this.observer = new MutationObserver(this.handleMutations);
    this.observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    // Listen for selection changes to detect context
    this.selectionHandler = this.handleSelectionChange.bind(this);
    document.addEventListener('selectionchange', this.selectionHandler);
  }

  /**
   * Detach from the container. Stop observing and clean up.
   */
  detach(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.selectionHandler) {
      document.removeEventListener('selectionchange', this.selectionHandler);
      this.selectionHandler = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.container = null;
  }

  // ----------------------------------------------------------
  // Make elements editable
  // ----------------------------------------------------------

  /**
   * Set contentEditable on all direct children of the container.
   * Table cells get individual editability; other blocks are editable as wholes.
   */
  makeChildrenEditable(container: HTMLElement): void {
    const children = Array.from(container.children) as HTMLElement[];
    for (const child of children) {
      if (child.tagName === 'TABLE') {
        // For tables, make individual cells editable (not the table itself)
        this.makeTableCellsEditable(child);
      } else {
        child.contentEditable = 'true';
      }
    }
  }

  private makeTableCellsEditable(table: HTMLElement): void {
    const cells = table.querySelectorAll('td, th');
    cells.forEach((cell) => {
      (cell as HTMLElement).contentEditable = 'true';
    });
  }

  // ----------------------------------------------------------
  // Mutation handling
  // ----------------------------------------------------------

  private handleMutations = (_mutations: MutationRecord[]): void => {
    // Debounce to avoid excessive re-pagination
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.pushUndoSnapshot();
      this.notifyChange();
    }, EditableManager.DEBOUNCE_MS);
  };

  // ----------------------------------------------------------
  // Selection / context detection
  // ----------------------------------------------------------

  private handleSelectionChange(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !this.container) {
      this.setContext('none');
      return;
    }

    const range = selection.getRangeAt(0);
    const node = range.startContainer;

    // Walk up from the selection to find context
    let current: Node | null = node;
    while (current && current !== this.container) {
      if (current instanceof HTMLElement) {
        const tag = current.tagName;
        if (tag === 'TD' || tag === 'TH' || tag === 'TABLE') {
          this.setContext('table');
          return;
        }
        if (tag === 'IMG') {
          this.setContext('image');
          return;
        }
        if (current.dataset?.dopecanvasChart) {
          this.setContext('chart');
          return;
        }
      }
      current = current.parentNode;
    }

    // Default to text context if inside our container
    if (this.container.contains(node)) {
      this.setContext('text');
    } else {
      this.setContext('none');
    }
  }

  private setContext(ctx: ToolbarContext): void {
    if (ctx !== this.currentContext) {
      this.currentContext = ctx;
      this.contextCallbacks.forEach((cb) => cb(ctx));
    }
  }

  getContext(): ToolbarContext {
    return this.currentContext;
  }

  // ----------------------------------------------------------
  // Undo / Redo
  // ----------------------------------------------------------

  private pushUndoSnapshot(): void {
    if (!this.container) return;
    const html = this.container.innerHTML;
    const last = this.undoStack[this.undoStack.length - 1];
    // Don't push duplicates
    if (last && last.html === html) return;

    this.undoStack.push({ html, timestamp: Date.now() });
    // Clear redo stack on new change
    this.redoStack = [];
    // Limit stack size
    if (this.undoStack.length > EditableManager.MAX_UNDO_STACK) {
      this.undoStack.shift();
    }
  }

  undo(): boolean {
    if (!this.container || this.undoStack.length <= 1) return false;

    // Pop current state to redo stack
    const current = this.undoStack.pop()!;
    this.redoStack.push(current);

    // Restore previous state
    const previous = this.undoStack[this.undoStack.length - 1];
    this.pauseObserver(() => {
      this.container!.innerHTML = previous.html;
      this.makeChildrenEditable(this.container!);
    });
    this.notifyChange();
    return true;
  }

  redo(): boolean {
    if (!this.container || this.redoStack.length === 0) return false;

    const next = this.redoStack.pop()!;
    this.undoStack.push(next);

    this.pauseObserver(() => {
      this.container!.innerHTML = next.html;
      this.makeChildrenEditable(this.container!);
    });
    this.notifyChange();
    return true;
  }

  /** Temporarily disconnect observer to avoid feedback loops */
  private pauseObserver(fn: () => void): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    fn();
    if (this.observer && this.container) {
      this.observer.observe(this.container, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }
  }

  // ----------------------------------------------------------
  // Event callbacks
  // ----------------------------------------------------------

  onChange(callback: ChangeCallback): Unsubscribe {
    this.changeCallbacks.add(callback);
    return () => {
      this.changeCallbacks.delete(callback);
    };
  }

  onContextChange(callback: ContextChangeCallback): Unsubscribe {
    this.contextCallbacks.add(callback);
    return () => {
      this.contextCallbacks.delete(callback);
    };
  }

  private notifyChange(): void {
    this.changeCallbacks.forEach((cb) => cb());
  }

  // ----------------------------------------------------------
  // Formatting commands
  // ----------------------------------------------------------

  /**
   * Execute a formatting command on the current selection.
   * Uses document.execCommand for broad browser support.
   */
  execCommand(command: string, value?: string): boolean {
    return document.execCommand(command, false, value);
  }

  /** Check if a command is active for the current selection */
  queryCommandState(command: string): boolean {
    return document.queryCommandState(command);
  }

  /** Get the value of a command for the current selection */
  queryCommandValue(command: string): string {
    return document.queryCommandValue(command);
  }

  // ----------------------------------------------------------
  // Content access
  // ----------------------------------------------------------

  getHTML(): string {
    if (!this.container) return '';
    return this.container.innerHTML;
  }

  getPlainText(): string {
    if (!this.container) return '';
    return this.container.innerText || this.container.textContent || '';
  }
}
