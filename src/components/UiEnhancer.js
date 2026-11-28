'use client';

import { useEffect } from 'react';

/**
 * Two small, app-wide helpers for the content panel. They only add attributes; they never move or remove anything.
 *
 * 1. Tables: each cell gets its column heading as `data-label`, so on a phone a wide table can be shown as a
 *    stack of cards (see "Phone: tables as cards" in globals.css). Add `data-no-cards` to a table to opt out.
 * 2. Form controls with no accessible name get one for screen readers, taken from the nearest label text,
 *    the placeholder, or the first option.
 */
export default function UiEnhancer() {
  useEffect(() => {
    const root = document.getElementById('main-content');
    if (!root) return undefined;
    let timer;
    const run = () => {
      root.querySelectorAll('table').forEach((table) => {
        if (table.hasAttribute('data-no-cards')) return;
        // Column headings, without sort arrows; an "Actions" column needs no label on a card.
        const heads = [...table.querySelectorAll('thead th')].map(th => (th.textContent || '').replace(/[▲▼↑↓↕⇅]/g, '').trim()).map(h => (/^actions?$/i.test(h) ? '' : h));
        if (heads.length < 4) return;
        if (!table.hasAttribute('data-cards')) table.setAttribute('data-cards', '');
        table.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => {
          if (td.tagName === 'TD' && !td.hasAttribute('colspan') && heads[i] !== undefined && td.getAttribute('data-label') !== heads[i]) td.setAttribute('data-label', heads[i]);
        }));
      });

      root.querySelectorAll('input:not([type="hidden"]):not([aria-label]):not([aria-labelledby]), select:not([aria-label]):not([aria-labelledby]), textarea:not([aria-label]):not([aria-labelledby])').forEach((el) => {
        if (el.title || el.closest('label')) return;
        if (el.id && root.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return;
        let name = '';
        let node = el;
        for (let hop = 0; hop < 3 && !name && node && node !== root; hop += 1) {
          let prev = node.previousElementSibling;
          while (prev && !name) {
            const txt = prev.matches('label, span, div, p, strong, h3, h4') && prev.children.length <= 1 ? (prev.innerText || '').trim() : '';
            if (txt && txt.length <= 48) name = txt;
            prev = prev.previousElementSibling;
          }
          node = node.parentElement;
        }
        if (!name) name = el.placeholder || '';
        if (!name && el.tagName === 'SELECT') name = el.options[0]?.text || '';
        if (!name && el.type === 'checkbox') name = el.closest('thead') ? 'Select all rows' : el.closest('td') ? 'Select row' : 'Checkbox';
        if (!name && el.type === 'file') name = 'Choose a file';
        if (name) el.setAttribute('aria-label', name.replace(/\s*\*$/, ''));
      });
    };
    const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(run, 150); });
    observer.observe(root, { childList: true, subtree: true });
    run();
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, []);
  return null;
}
