// tools/test/loader.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

// The loader is dual-mode: a browser <script> AND a CJS module.
// require() triggers the module.exports branch at the end of the IIFE.
const loaderPath = path.resolve(__dirname, '..', '..', 'war', 'js', 'unitProfileLoader.js');

test('loader module loads under Node without throwing', () => {
    const loader = require(loaderPath);
    assert.ok(loader, 'loader should export an object');
});
