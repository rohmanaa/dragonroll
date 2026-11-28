import { defineConfig } from 'vite';
import path from 'path';

const __dirname = path.resolve();

export default defineConfig({
  root: '.',
  base: './',
  resolve: {
    alias: {
      three: path.resolve(__dirname, 'src/vendor/three.r170.module.min.js'),
      'three/addons/': path.resolve(__dirname, 'src/vendor/three-addons/') + '/',
    },
  },
  build: {
    outDir: '../dist',
    rollupOptions: {
      external: ['three', /^three\/addons\//],
      input: {
        index: 'index.html',
        play: 'play.html',
        splash: 'splash.html',
        gameplay: 'gameplay.html',
        tambang: 'tambang.html',
        powerup: 'powerup.html',
        tos: 'tos.html',
      },
    },
  },
});
