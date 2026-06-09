import { defineConfig } from 'vite';

// Phase 0: build the local-first sync layer as a self-contained IIFE global
// (window.BartmossSync). The legacy static app (index.html, cs.html, js/*.js)
// is untouched and keeps working when served statically; it can optionally
// load js/sync.bundle.js and call into the global. Multi-page / Svelte / PWA
// migration happens in later phases.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/sync/index.ts',
      name: 'BartmossSync',
      formats: ['iife'],
      fileName: () => 'sync.bundle.js',
    },
    outDir: 'js',
    emptyOutDir: false, // never wipe js/ — it holds the legacy app scripts
    sourcemap: true,
    target: 'es2019',
  },
});
