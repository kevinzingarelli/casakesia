import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CURRENT_VERSION } from './src/changelog.js';

// Scrive dist/version.json a fine build: è il file che l'app aperta sul
// telefono rilegge ogni tanto per accorgersi che ne è uscita una versione
// più nuova e proporre "Aggiorna".
function versionFile() {
  return {
    name: 'casa-points-version-file',
    closeBundle() {
      writeFileSync(resolve('dist/version.json'), JSON.stringify({ version: CURRENT_VERSION }));
    },
  };
}

export default defineConfig({
  plugins: [react(), versionFile()],
});
