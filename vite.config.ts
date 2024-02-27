import { defineConfig } from 'vite';
import copy from 'rollup-plugin-copy';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import vue from '@vitejs/plugin-vue';
import alias from '@rollup/plugin-alias';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          plugins: [
            copy({
              targets: [
                { src: 'electron/whisper/lib/*', dest: 'dist-electron/whisper/' },
              ],
            }),
          ],
          build: {
            rollupOptions: {
              plugins: [
                alias({
                  entries: [
                    // https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/573#issuecomment-1614993431
                    {
                      find: "./lib-cov/fluent-ffmpeg",
                      replacement: "./lib/fluent-ffmpeg",
                    },
                  ],
                }),
              ],
              external: [
                'shelljs',
                'sqlite3',
              ],
            },
          },
          resolve: {
            alias: {},
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
      },
    ]),
    renderer(),
  ],
});
