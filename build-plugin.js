const esbuild = require('esbuild');
const fs = require('fs');

const vendettaModules = {
  '@vendetta': 'vendetta',
  '@vendetta/metro/common': 'vendetta.metro.common',
  '@vendetta/metro': 'vendetta.metro',
  '@vendetta/storage': 'vendetta.storage',
  '@vendetta/ui/toasts': 'vendetta.ui.toasts',
  '@vendetta/ui/assets': 'vendetta.ui.assets',
  '@vendetta/patcher': 'vendetta.patcher',
  '@vendetta/ui/components': 'vendetta.ui.components',
  '@vendetta/utils': 'vendetta.utils',
  'react': 'window.React',
  'react-native': 'vendetta.metro.common.ReactNative',
};

const paramOrder = ['Y', 'p', 'r', 'x', 'Pt', 'D', 're', 'k', 'R', 'Q', 'Qe', 'ne'];
const argOrder = [
  '{}', 'vendetta', 'vendetta.metro.common', 'vendetta.metro',
  'window.React', 'vendetta.storage', 'vendetta.metro.common.ReactNative',
  'vendetta.ui.toasts', 'vendetta.ui.assets', 'vendetta.patcher',
  'vendetta.ui.components', 'vendetta.utils',
];

const importMap = {};
const importKeys = Object.keys(vendettaModules);
for (let i = 0; i < importKeys.length; i++) {
  importMap[importKeys[i]] = paramOrder[i + 1];
}

async function build() {
  const result = await esbuild.build({
    entryPoints: ['src/index.tsx'],
    bundle: true,
    format: 'iife',
    write: false,
    external: Object.keys(vendettaModules),
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
  });

  let code = result.outputFiles[0].text;

  // Remove the __require shim (everything up to the first blank line after it)
  code = code.replace(/var __require =[\s\S]*?\n\n/, '\n');

  // Replace require() calls with Vendetta module references
  for (const [imp, param] of Object.entries(importMap)) {
    const re1 = new RegExp('__require\\("' + imp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"\\)', 'g');
    const re2 = new RegExp("__require\\('" + imp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\)", 'g');
    code = code.replace(re1, param);
    code = code.replace(re2, param);
  }

  // Remove the IIFE wrapper and rewrap with Vendetta format
  code = code.replace(/^\(\(\) => \{/, '').replace(/\}\)\(\);?\s*$/, '');
  const body = code.trim();
  const wrapped = '(function(' + paramOrder.join(',') + '){"use strict";' + body + 'return Y.default=Y,Y})(' + argOrder.join(',') + ');';

  fs.mkdirSync('multi-scrobbler', { recursive: true });
  fs.writeFileSync('multi-scrobbler/index.js', wrapped);
  console.log('Build complete:', (wrapped.length / 1024).toFixed(1) + 'kb');
}

build().catch(e => { console.error(e); process.exit(1); });
