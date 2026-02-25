import { createRef } from 'react';
import { render, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DopeCanvas } from './DopeCanvas';
import type { DopeCanvasHandle } from './DopeCanvas';

type Mode = 'page' | 'flow';

afterEach(() => {
  cleanup();
});

function getShadowRoot(container: HTMLElement): ShadowRoot {
  const host = container.querySelector('.dopecanvas-host') as HTMLDivElement | null;
  expect(host).not.toBeNull();
  expect(host?.shadowRoot).not.toBeNull();
  return host!.shadowRoot!;
}

async function waitForEditable(root: ShadowRoot, mode: Mode): Promise<HTMLElement> {
  return waitFor(() => {
    if (mode === 'flow') {
      const el = root.querySelector('.dopecanvas-flow-content') as HTMLElement | null;
      if (!el) throw new Error('Flow editable not rendered yet');
      return el;
    }

    const el = root.querySelector('.dopecanvas-block-content') as HTMLElement | null;
    if (!el) throw new Error('Page block content not rendered yet');
    return el;
  });
}

describe('DopeCanvas isolation', () => {
  it.each<Mode>(['page', 'flow'])(
    'keeps host styles isolated in %s mode',
    async (mode) => {
      const hostProbe = document.createElement('div');
      hostProbe.className = 'host-layout-probe';
      hostProbe.textContent = 'outside';
      document.body.appendChild(hostProbe);

      const { container, unmount } = render(
        <DopeCanvas
          renderMode={mode}
          html="<p>Test</p>"
          css={`
            .host-layout-probe { color: rgb(255, 0, 0) !important; }
            html, body, :root, * { box-sizing: content-box !important; }
          `}
        />
      );

      const root = getShadowRoot(container);
      await waitForEditable(root, mode);

      expect(getComputedStyle(hostProbe).color).not.toBe('rgb(255, 0, 0)');

      unmount();
      hostProbe.remove();
    }
  );

  it.each<Mode>(['page', 'flow'])(
    'persists live edits through getHTML in %s mode',
    async (mode) => {
      const ref = createRef<DopeCanvasHandle>();
      const { container } = render(
        <DopeCanvas ref={ref} renderMode={mode} html="<p>Original</p>" />
      );

      const root = getShadowRoot(container);
      const editable = await waitForEditable(root, mode);

      if (mode === 'flow') {
        editable.innerHTML = '<p>Edited Flow</p>';
        editable.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        editable.innerHTML = '<p>Edited Page</p>';
      }

      const saved = ref.current?.getHTML() || '';
      expect(saved).toContain(mode === 'flow' ? 'Edited Flow' : 'Edited Page');
      expect(saved).not.toContain('dopecanvas-root');
      expect(saved).not.toContain('dopecanvas-host');
    }
  );

  it.each<Mode>(['page', 'flow'])(
    'keeps behavior parity between modes for base fixture in %s mode',
    async (mode) => {
      const fixture = '<h1>Fixture Title</h1><p>Fixture body copy.</p>';
      const ref = createRef<DopeCanvasHandle>();
      const { container } = render(
        <DopeCanvas ref={ref} renderMode={mode} html={fixture} />
      );

      const root = getShadowRoot(container);
      await waitForEditable(root, mode);

      const html = ref.current?.getHTML() || '';
      expect(html).toContain('<h1');
      expect(html).toContain('Fixture Title');
      expect(html).toContain('<p');
      expect(html).toContain('Fixture body copy.');
    }
  );
});
