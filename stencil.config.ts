// SPDX-FileCopyrightText: 2025 NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: CC0-1.0

import { Config } from '@stencil/core';

// https://stenciljs.com/docs/config

export const config: Config = {
  namespace: 'noi-digiway',
  // buildEs5: true,
  // hashFileNames: false,
  // globalStyle: 'src/global/app.css',
  // globalScript: 'src/global/app.ts',
  // taskQueue: 'async',
  bundles: [
    {
      components: [
        'noi-digiway'
      ]
    },
  ],
  outputTargets: [
    {
      // more: https://stenciljs.com/docs/www
      type: 'www',
      dir: 'www',
      buildDir: '',
      empty: true,
      serviceWorker: null,
      copy: [
        {
          src: "../assets",
          dest: ".",
          warn: true,
        },
        {
          src: "../node_modules/leaflet/dist/images",
          dest: "images",
          warn: true,
        }
      ],
    },
    {
      // https://stenciljs.com/docs/custom-elements
      type: 'dist-custom-elements',
      customElementsExportBehavior: 'auto-define-custom-elements',
      externalRuntime: false,
      generateTypeDeclarations: false,
      empty: true,
      minify: true,
    },
  ],

  devServer: {
    port: 8998,
  }
};
