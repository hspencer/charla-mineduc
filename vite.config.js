// vite.config.js
//
// Configuración de Vite para la presentación reveal.js "charla-mineduc".
// Misma configuración que /pictos-chile y /cc:
// - base '/charla-mineduc/': prefijo bajo el cual se sirve la app en
//   GitHub Pages y en el servidor de desarrollo. Visitar
//   http://localhost:5173/charla-mineduc/ y no la raíz.
// - alias '@reveal': importar SCSS de reveal.js sin ruta completa.
// - silenceDeprecations: silencia advertencias de Sass que provienen
//   del propio reveal.js (no accionables desde nuestro código).

import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

// Plugin: escribe docs/.nojekyll para que GitHub Pages no filtre assets/_*
const nojekyll = () => ({
  name: 'nojekyll',
  closeBundle() {
    fs.writeFileSync('docs/.nojekyll', '');
  }
});

export default defineConfig({
  plugins: [nojekyll()],
  base: '/charla-mineduc/',
  resolve: {
    alias: {
      '@reveal': path.resolve(__dirname, 'node_modules/reveal.js/src/css')
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['import', 'global-builtin']
      }
    }
  },
  build: {
    outDir: 'docs',
    emptyOutDir: true
  }
});
