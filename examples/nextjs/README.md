# VitalLens + Next.js

Minimal App Router example. `vitallens` is loaded on demand in a client
component, so it never runs during server rendering.

```bash
# from the repository root, build the library first
npm run build
cd examples/nextjs
npm install
NEXT_PUBLIC_VITALLENS_API_KEY=YOUR_API_KEY npm run dev
```

Works with both Turbopack (default) and webpack (`next dev --webpack`).
