'use client';

import { createElement, useEffect, useState } from 'react';

const ELEMENTS = [
  { tag: 'vitallens-widget', label: 'Widget' },
  { tag: 'vitallens-scan', label: 'Scan' },
  { tag: 'vitallens-monitor', label: 'Monitor' },
  { tag: 'vitallens-file', label: 'File' },
];

// vitallens is a browser-only library (camera, workers, WebAssembly) and its
// bundle is large, so load it on demand from an effect rather than at module
// level. Importing it also registers the <vitallens-*> web components.
export default function VitalsDemo() {
  const [ready, setReady] = useState(false);
  const [tag, setTag] = useState(ELEMENTS[0].tag);

  useEffect(() => {
    import('vitallens').then(() => setReady(true));
  }, []);

  return (
    <>
      <nav
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'center',
          padding: 12,
        }}
      >
        {ELEMENTS.map(({ tag: t, label }) => (
          <button
            key={t}
            onClick={() => setTag(t)}
            disabled={t === tag}
            style={{ padding: '6px 14px' }}
          >
            {label}
          </button>
        ))}
      </nav>
      <main style={{ display: 'flex', justifyContent: 'center' }}>
        {ready ? (
          // key remounts the element on switch so the previous one (and its
          // camera stream) is torn down. Don't set `display` on the element:
          // the components lay themselves out.
          createElement(tag, {
            key: tag,
            'api-key': process.env.NEXT_PUBLIC_VITALLENS_API_KEY,
            style: { maxWidth: 960 },
          })
        ) : (
          <p style={{ color: 'white' }}>Loading VitalLens…</p>
        )}
      </main>
    </>
  );
}
