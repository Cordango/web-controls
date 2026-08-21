// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.

import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.js', import.meta.url)),
      name: 'CordangoWebControls',
      fileName: (format) => `cordango-web-controls.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs'],
      // Named explicitly so it matches the "./styles" export in package.json. Vite's default is
      // derived from the library name, which is a thing that can be renamed without anybody
      // noticing the export path no longer resolves.
      cssFileName: 'style',
    },
    rollupOptions: {
      // The host owns these. Bundling Vue would give a generated application two copies of the
      // reactivity system, which fails in ways that look like a component bug rather than a
      // packaging one, and bundling Vuetify would freeze its version for everyone downstream.
      // chart.js is a real dependency rather than a peer one, so the consumer already installs
      // it. Bundling it as well would ship a second copy and freeze its version for everybody
      // downstream, which is the same argument as for Vue with a smaller blast radius.
      external: ['vue', 'vuetify', 'vue-i18n', 'chart.js', /^vuetify\//, /^chart\.js\//],
      output: {
        globals: {
          vue: 'Vue', vuetify: 'Vuetify', 'vue-i18n': 'VueI18n', 'chart.js': 'Chart',
        },
      },
    },
    // A generated repository is reviewed in a diff, so its vendored dependency should be readable
    // rather than minified into one line.
    minify: false,
    sourcemap: true,
  },
})
