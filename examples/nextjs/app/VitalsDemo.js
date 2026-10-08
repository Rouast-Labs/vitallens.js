'use client';

import { useEffect, useState } from 'react';

// vitallens is a browser-only library (camera, workers, WebAssembly) and its
// bundle is large, so load it on demand from an effect rather than at module
// level. Importing it also registers the <vitallens-*> web components.
export default function VitalsDemo() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    import('vitallens').then(() => setReady(true));
  }, []);

  if (!ready) return <p>Loading VitalLens…</p>;

  return (
    <vitallens-widget
      api-key={process.env.NEXT_PUBLIC_VITALLENS_API_KEY}
      style={{ display: 'block', maxWidth: 960, margin: '0 auto' }}
    />
  );
}
