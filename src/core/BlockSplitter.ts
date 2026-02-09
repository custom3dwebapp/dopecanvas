// ============================================================
// BlockSplitter — Split oversized blocks at page boundaries
// ============================================================
// When a block is taller than the remaining space on a page,
// this utility splits it into two pieces so that content flows
// naturally from one page to the next.
//
// Two splitting strategies:
// 1. Child-element boundary — for blocks with multiple children
//    (e.g. <div> with <p>s, <ul> with <li>s, <table> with <tr>s)
// 2. Text line boundary — for single text blocks (<p>, <h1>, etc.)
//    Uses the Range API to find the line that crosses the boundary.
//
// Split blocks are marked with data attributes so they can be
// recombined before the next re-pagination cycle.
// ============================================================

/** Result of splitting a block */
export interface SplitResult {
  firstHTML: string;
  secondHTML: string;
}

/** Unique ID counter for split blocks */
let splitIdCounter = 0;
function nextSplitId(): string {
  return `split-${++splitIdCounter}-${Date.now()}`;
}

/** Minimum remaining height (in px) to attempt a split */
const MIN_SPLIT_HEIGHT = 40;

/** Tags that should never be split */
const UNSPLITTABLE_TAGS = new Set([
  'script', 'style', 'img', 'video', 'canvas', 'svg', 'hr',
  'iframe', 'object', 'embed', 'audio', 'picture', 'figure',
]);

/** Tags eligible for text-level splitting */
const TEXT_BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
  'div', 'li', 'span', 'td', 'th', 'pre', 'code',
]);

// ----------------------------------------------------------
// Public API
// ----------------------------------------------------------

/**
 * Try to split a block element so that the first piece fits
 * within `availableHeight` pixels. Returns null if the block
 * cannot be split (too small, unsplittable tag, etc.).
 *
 * The element must be in the DOM (attached to a measurement
 * container) so that getBoundingClientRect / Range work.
 */
export function trySplitBlock(
  element: HTMLElement,
  availableHeight: number
): SplitResult | null {
  const tag = element.tagName.toLowerCase();

  // Never split certain elements
  if (UNSPLITTABLE_TAGS.has(tag)) return null;

  // Skip if available height is too tiny
  if (availableHeight < MIN_SPLIT_HEIGHT) return null;

  // Skip page-break markers
  const style = window.getComputedStyle(element);
  if (
    style.getPropertyValue('break-before') === 'page' ||
    style.getPropertyValue('page-break-before') === 'always'
  ) {
    return null;
  }

  // Strategy 1: split at child element boundaries
  const children = Array.from(element.children) as HTMLElement[];
  if (children.length > 1) {
    const result = splitAtChildBoundary(element, children, availableHeight);
    if (result) return result;
  }

  // Strategy 2: split at text line boundary
  if (TEXT_BLOCK_TAGS.has(tag) || element.childNodes.length > 0) {
    const result = splitAtTextBoundary(element, availableHeight);
    if (result) return result;
  }

  return null;
}

/**
 * Recombine adjacent split blocks back into their original block.
 * Call this before re-measuring / re-paginating so that the
 * splitter can re-evaluate where to split.
 *
 * Takes an array of block HTML strings and returns a new array
 * with split blocks merged.
 */
export function recombineSplitBlocks(blockHTMLs: string[]): string[] {
  if (blockHTMLs.length === 0) return blockHTMLs;

  const result: string[] = [];
  let i = 0;

  while (i < blockHTMLs.length) {
    const html = blockHTMLs[i];

    // Check if this block is a split block
    const splitId = extractSplitId(html);
    if (!splitId) {
      result.push(html);
      i++;
      continue;
    }

    // Collect all parts with the same split-id
    const parts: string[] = [html];
    let j = i + 1;
    while (j < blockHTMLs.length) {
      const nextId = extractSplitId(blockHTMLs[j]);
      if (nextId === splitId) {
        parts.push(blockHTMLs[j]);
        j++;
      } else {
        break;
      }
    }

    // Recombine
    result.push(mergeBlockParts(parts));
    i = j;
  }

  return result;
}

// ----------------------------------------------------------
// Strategy 1: Split at child element boundaries
// ----------------------------------------------------------

function splitAtChildBoundary(
  element: HTMLElement,
  children: HTMLElement[],
  availableHeight: number
): SplitResult | null {
  const blockTop = element.getBoundingClientRect().top;
  let splitIndex = -1;

  // Find the first child whose bottom exceeds the available height
  for (let i = 0; i < children.length; i++) {
    const childRect = children[i].getBoundingClientRect();
    const childStyle = window.getComputedStyle(children[i]);
    const marginBottom = parseFloat(childStyle.marginBottom) || 0;
    const childBottom = childRect.bottom + marginBottom - blockTop;

    if (childBottom > availableHeight && i > 0) {
      splitIndex = i;
      break;
    }
  }

  if (splitIndex <= 0) return null; // Can't split (all children on first or nothing above)

  // Create two copies of the parent element (preserving tag + attributes)
  const firstEl = element.cloneNode(false) as HTMLElement;
  const secondEl = element.cloneNode(false) as HTMLElement;

  for (let i = 0; i < children.length; i++) {
    if (i < splitIndex) {
      firstEl.appendChild(children[i].cloneNode(true));
    } else {
      secondEl.appendChild(children[i].cloneNode(true));
    }
  }

  // Add split markers
  const id = nextSplitId();
  firstEl.setAttribute('data-dopecanvas-split-id', id);
  firstEl.setAttribute('data-dopecanvas-split-part', '0');
  secondEl.setAttribute('data-dopecanvas-split-id', id);
  secondEl.setAttribute('data-dopecanvas-split-part', '1');

  return {
    firstHTML: firstEl.outerHTML,
    secondHTML: secondEl.outerHTML,
  };
}

// ----------------------------------------------------------
// Strategy 2: Split at text line boundary
// ----------------------------------------------------------

function splitAtTextBoundary(
  element: HTMLElement,
  availableHeight: number
): SplitResult | null {
  const blockTop = element.getBoundingClientRect().top;

  // Collect all text nodes in document order
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  if (textNodes.length === 0) return null;

  // Find the text node + offset where content crosses the boundary
  let splitNode: Text | null = null;
  let splitOffset = 0;

  for (const textNode of textNodes) {
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const nodeRect = range.getBoundingClientRect();

    // If this entire text node is above the boundary, skip
    if (nodeRect.bottom - blockTop <= availableHeight) continue;

    // If this entire text node starts below the boundary, split before it
    if (nodeRect.top - blockTop >= availableHeight) {
      splitNode = textNode;
      splitOffset = 0;
      break;
    }

    // This text node crosses the boundary — binary search within it
    let lo = 0;
    let hi = textNode.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const r = document.createRange();
      r.setStart(textNode, mid);
      r.collapse(true);
      const rr = r.getBoundingClientRect();
      if (rr.top - blockTop >= availableHeight) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }

    splitNode = textNode;
    splitOffset = lo;
    break;
  }

  if (!splitNode) return null;

  // Back up to a word boundary (don't split in the middle of a word)
  const text = splitNode.textContent || '';
  let wordBound = splitOffset;
  while (wordBound > 0 && text[wordBound - 1] !== ' ' && text[wordBound - 1] !== '\n') {
    wordBound--;
  }
  if (wordBound > 0) {
    splitOffset = wordBound;
  }

  // Don't split if the offset is at the very start or end
  if (splitOffset === 0 && splitNode === textNodes[0]) return null;
  if (splitOffset >= text.length && splitNode === textNodes[textNodes.length - 1]) return null;

  // Use Range.cloneContents() to create the two halves.
  // This correctly preserves inline formatting elements (strong, em, etc.)
  try {
    // Range for the first half: start of element → split point
    const firstRange = document.createRange();
    firstRange.setStart(element, 0);
    firstRange.setEnd(splitNode, splitOffset);

    // Range for the second half: split point → end of element
    const secondRange = document.createRange();
    secondRange.setStart(splitNode, splitOffset);
    secondRange.setEndAfter(element.lastChild!);

    const firstFragment = firstRange.cloneContents();
    const secondFragment = secondRange.cloneContents();

    // Check that both halves have actual content
    const firstText = fragmentToText(firstFragment);
    const secondText = fragmentToText(secondFragment);
    if (firstText.trim().length === 0 || secondText.trim().length === 0) {
      return null;
    }

    // Wrap each half in the same element tag with same attributes
    const firstEl = element.cloneNode(false) as HTMLElement;
    firstEl.appendChild(firstFragment);
    const secondEl = element.cloneNode(false) as HTMLElement;
    secondEl.appendChild(secondFragment);

    // Add split markers
    const id = nextSplitId();
    firstEl.setAttribute('data-dopecanvas-split-id', id);
    firstEl.setAttribute('data-dopecanvas-split-part', '0');
    secondEl.setAttribute('data-dopecanvas-split-id', id);
    secondEl.setAttribute('data-dopecanvas-split-part', '1');

    return {
      firstHTML: firstEl.outerHTML,
      secondHTML: secondEl.outerHTML,
    };
  } catch {
    return null;
  }
}

// ----------------------------------------------------------
// Recombination helpers
// ----------------------------------------------------------

/** Extract the split-id from a block's HTML string (fast regex check) */
function extractSplitId(html: string): string | null {
  const match = html.match(/data-dopecanvas-split-id="([^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Merge multiple split-part HTML strings back into one block.
 * Combines the innerHTML of all parts into the first part's
 * outer element (preserving tag + original attributes minus split markers).
 */
function mergeBlockParts(parts: string[]): string {
  const container = document.createElement('div');

  // Parse each part and collect inner content
  const innerParts: string[] = [];
  let outerTag = '';
  let outerAttrs = '';

  for (const partHTML of parts) {
    container.innerHTML = partHTML;
    const el = container.firstElementChild as HTMLElement;
    if (!el) continue;

    if (!outerTag) {
      // Use the first part as the template for the outer element
      outerTag = el.tagName.toLowerCase();
      const clone = el.cloneNode(false) as HTMLElement;
      clone.removeAttribute('data-dopecanvas-split-id');
      clone.removeAttribute('data-dopecanvas-split-part');
      // Get the opening tag
      const tmp = document.createElement('div');
      tmp.appendChild(clone);
      const fullTag = tmp.innerHTML;
      // Extract opening tag (everything before the closing)
      const closeIdx = fullTag.lastIndexOf('</');
      outerAttrs = closeIdx >= 0 ? fullTag.substring(0, closeIdx) : fullTag;
    }

    innerParts.push(el.innerHTML);
  }

  if (!outerTag) return parts[0]; // fallback

  return `${outerAttrs}${innerParts.join('')}</${outerTag}>`;
}

/** Get plain text from a DocumentFragment */
function fragmentToText(fragment: DocumentFragment): string {
  const div = document.createElement('div');
  div.appendChild(fragment.cloneNode(true));
  return div.textContent || '';
}
