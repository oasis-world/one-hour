import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Vite 8's default CSS minifier (Lightning CSS) dedupes adjacent
    // `backdrop-filter` + `-webkit-backdrop-filter` down to the prefixed
    // form only (and minifies `blur(0px)` to an invalid `blur()`), which
    // strips the frosted glass in browsers that only implement the
    // standard property. esbuild minifies without dropping prefixes.
    cssMinify: 'esbuild',
  },
})
